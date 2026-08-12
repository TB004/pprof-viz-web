# AGENTS.md

Non-obvious constraints for AI agents working in `pprof-viz`. See the README for what the
project is and how to build it; read the source for structure. Only things you can't infer
cheaply belong here.

## Commands

Run everything through `just` (see the [Justfile](Justfile) for the full list). `just verify`
(check + lint + format-check) is the gate a change must pass.

## Architecture

Rust owns business logic: persistence (SQLite + Tauri store), the ConnectRPC client to
`pprof-viz-agent`, and the active collection session. Svelte is a thin presentation layer.

**Session state, metrics buffering, and elapsed timers live in Rust memory on purpose** —
moving them into the frontend reintroduces browser tab throttling, which stalls collection
when the window is backgrounded. Don't relocate them.

## IPC

Typed via `tauri-specta`. `src/lib/bindings.ts` is **generated** — never edit it by hand; it
is re-exported on every debug build from `make_builder()` in `src-tauri/src/lib.rs`.

- A new Tauri command must be added to `collect_commands!` in `src-tauri/src/lib.rs`, or it
  won't exist on the frontend.
- Frontend code calls the wrappers in `src/lib/ipc.ts`, not `invoke` directly. `run()` there
  unwraps the `{status: "ok" | "error"}` envelope into a thrown `Error`.
- Commands return `Result<T, String>` so errors cross the boundary as that envelope.

## Rust

- SQL goes through the checked `sqlx::query!` / `query_as!` macros, verified at compile time
  against the offline data in `src-tauri/.sqlx` (committed; no database needed to build).
  After touching a query or a migration, run `just sqlx-prepare` — a stale `.sqlx` fails the
  build. SQLite reports `TEXT PRIMARY KEY` columns as nullable, hence the `id AS "id!"`
  casts; enum and `i16` columns need `col AS "col: Type"` overrides.
- No `.unwrap()` / `.expect()` in production paths.
- Keep blocking work off the main thread — `tauri::async_runtime` or `std::thread` for the
  RPC stream loop and other heavy lifting.

## Svelte 5

- Runes only (`$state`, `$derived`, `$effect`, `$bindable`, `$props`). No Svelte 4 patterns:
  no `$:` reactive statements, no `onMount` for reactive state.
- Shared mutable state goes in co-located `.svelte.ts` files, not prop drilling.

## Licensing

GPL-3.0-or-later. **Every new first-party source file gets a header**, in that file's comment
syntax (`//` for `.rs`/`.ts`/`.js`, an HTML comment above the `<script>` block for `.svelte`,
`#` below the shebang for shell):

```
// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later
```

Two exceptions, both third-party or generated — leave them unheadered: `src/lib/components/ui/**`
(vendored shadcn-svelte, MIT) and `src/lib/bindings.ts`.

## Tooling landmines

- Tailwind CSS v4 — utility classes, **no config file**. Don't go looking for one.
- Use sidebar-namespaced design tokens (`sidebar-*`) inside sidebar components.
- Biome cannot parse Svelte 5 `{#snippet}` blocks with TypeScript parameter annotations; it
  reports a syntax error. Leave the annotations off.
- Suppress the getter/setter `bind:prop={() => x, (v) => set(v)}` warning with:
  `// biome-ignore lint/complexity/noCommaOperator: Svelte 5 getter/setter bind syntax`
