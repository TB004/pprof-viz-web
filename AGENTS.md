# AGENTS.md

Non-obvious constraints for AI agents working in `pprof-viz-web`. See the README for what the
project is and how to build it; read the source for structure. Only things you can't infer
cheaply belong here.

## Commands

Run everything through `just` (see the [Justfile](Justfile) for the full list). `just verify`
(check + lint + format-check) is the gate a change must pass. On top of that, PR CI asserts
the generated protobuf client is not stale, runs `just vuln` and builds the static site — but
it never builds the container image, so nothing tests
[packaging/Caddyfile](packaging/Caddyfile). Changes to it are only exercised by `just image`
locally and by the release workflow.

There are two Containerfiles in `packaging/` and they must stay in sync: `Containerfile`
builds from source, `Containerfile.dist` packages an existing `build/`. The release workflow
uses the latter.

## Architecture

Everything runs in the browser. Code is grouped by feature, not by layer: a feature folder
holds its service, the logic only it uses, and the components that belong to it.

- `src/lib/` root — what every feature shares: `types.ts` (records and wire types),
  `utils.ts` (pure helpers, including `cn` for the shadcn components), `db.ts` (the
  IndexedDB wrapper and the app's schema), `files.ts` (OPFS, quota, open/save dialogs),
  `task.svelte.ts` (see Errors below), and the single-file services `settings.svelte.ts` and
  `updates.svelte.ts` (the service worker).
- `src/lib/session/` — the live collection: the Connect client (`collector.ts`, binary
  protobuf), the worker, `frames.ts` (merge/diff, also used by
  the archive), the service, the status bar and the profile chooser.
- `src/lib/profiles/` — projects and profiles: the service and the profile manager dialogs.
- `src/lib/archive/` — the `.ppvz` codec and the service for saved collections.
- `src/lib/transfer/` — `.ppvzb` bundles, import and export, and their dialogs.
- `src/lib/components/` — generic presentational pieces (page shell, charts, dialogs);
  `components/ui` is vendored shadcn-svelte.
- `src/routes/` — pages. A component only one page uses sits next to that page's
  `+page.svelte` (SvelteKit ignores files without a `+` prefix).

`src/lib/proto/gen` is generated; never hand-edit it.

Each service is one class holding reactive `$state`, taking its stores and peer services as
constructor arguments. `src/lib/app.svelte.ts` wires the one instance of each for the tab and
is what components import (`collectionService`, `archiveService`, …). Never construct a
service in a component: a second instance owns state nothing renders and, for the session, a
second worker. Components go through the services rather than calling `db.ts`, `files.ts`,
the codec or the RPC client themselves.

## Errors

There is no global error log. An error is shown where it happened:

- **Actions a user starts** (save, delete, import, export, …): the service method throws. The
  component that started it owns a `Task` (`#lib/task.svelte.ts`), runs the call through
  `task.run(...)`, and shows `task.error` with `ErrorAlert` next to the control — inside the
  dialog when the action came from a dialog. Reset the task when the dialog reopens.
- **Background failures with no button behind them** — the collection session, loading the
  profile catalog, loading the archive listing — live in that service's state (`error`) and
  are shown wherever that state is rendered: the status bar, the profile manager and
  chooser, the archive page.

## Things that will bite you

- **The collection session runs in a Web Worker** (`src/lib/session/worker.ts`). Merging a
  frame walks every histogram in the sample, and doing that on the main thread lands on the
  same frame budget the charts repaint in. The worker holds only the previous merged frame;
  the rolling buffer lives in the service, which the UI needs anyway.
- **Elapsed time is derived from `Date.now()`, never from counted ticks.** A backgrounded tab
  throttles `setInterval` to once a minute; the displayed figure has to survive that.
- **Frames arrive as sparse deltas.** Histograms stream only the buckets that moved
  (`updatedCounts`), and unchanged fields are omitted. Always go through `mergeFrame` — even
  for the first frame and for snapshot mode, which is what normalises histograms to dense
  `counts`.
- **`proto/collector.proto` is a shared contract, not a local file.** The collector compiles
  against the same schema. Change it there and here together, run `just proto`, and commit the
  regenerated client — CI fails if it is stale. The `.ppvz` container messages
  (`StoredCollection`, `CollectionMeta`) live in our own `proto/storage.proto`, not in the
  collector's.
- **Protobuf maps `uint64` to `bigint`.** Read with `Number(x ?? 0)` at the point of display.
  `JSON.stringify` throws on bigint, so anything that serializes a frame for display needs a
  replacer. Decoded messages also carry a `$typeName` key that is not payload — skip keys
  starting with `$` when iterating a group's fields.
- **`.ppvz` is a bare zstd frame wrapping a protobuf `StoredCollection`**, with no wrapper
  header of ours. Do not add one. zstd has no browser
  API, so it is carried as WebAssembly (`src/lib/archive/codec.ts`), which is why the CSP in
  `packaging/Caddyfile` needs `wasm-unsafe-eval`.
- **The zstd wasm module is per-document, and its results are views into its
  heap.** `codec.ts` therefore loads the module once, at module level, for the
  whole tab, and copies every result: calling the module's `init()` again
  re-instantiates it underneath whatever is already using it, and a result held
  across the next compress or decompress reads back as zeroes. Keep zstd access
  inside `codec.ts`.
- **A `.ppvzb` bundle is the only thing that carries projects and profiles.** It
  is a zip of `manifest.json` plus the untouched `collections/<ulid>.ppvz`
  payloads (`src/lib/transfer`), and it is ours alone; bare
  `.ppvz` stays the interchange format for a single collection. An imported file is untrusted: entry names outside
  `collections/<ulid>.ppvz` are dropped, the manifest is validated field by
  field, and every payload must decode before anything is written.
- **Collections denormalise their profile instead of referencing it**, so
  "the archives of this project" can only be matched on the captured
  `profileName` and `profileUrl`. Exports say so in the dialog.
- **A rename never rewrites the `.ppvz`.** The metadata row is authoritative, so
  export goes through `rewriteMeta` in the codec, which re-encodes only when the
  embedded meta actually differs.
- **The browser owns TLS and the HTTP version.** There is no per-profile "allow invalid
  certificates" or HTTP/3 toggle here, and there cannot be. A collector must present a trusted
  certificate and send CORS headers.
- **`src/service-worker.ts` is excluded from `tsconfig`** by SvelteKit and is compiled
  separately; it uses `/// <reference lib="webworker" />` rather than the app's lib set.
  SvelteKit registers it for you — only production builds have one, so `just dev` always
  reports offline support as unavailable; use `just preview` to exercise it. Applying an
  update is a two-step handshake: `ServiceWorkerService` (`src/lib/updates.svelte.ts`) posts `{ type: "skip-waiting" }` to
  the waiting worker and reloads from the `controllerchange` event, not from the post.
- Settings live in `localStorage`, not IndexedDB, because the inline script in `app.html` reads
  the theme synchronously before first paint. Both sides use the key `pprof-viz-settings`
  (`SETTINGS_KEY` in `src/lib/settings.svelte.ts`).

## Svelte 5

- Runes only (`$state`, `$derived`, `$effect`, `$bindable`, `$props`). No Svelte 4 patterns:
  no `$:` reactive statements, no `onMount` for reactive state.
- Shared mutable state goes in co-located `.svelte.ts` files, not prop drilling.

## Licensing

GPL-3.0-or-later. **Every new first-party source file gets a header**, in that file's comment
syntax (`//` for `.ts`/`.js`, an HTML comment above the `<script>` block for `.svelte`, `#` for
shell and the Caddyfile/Containerfile):

```
// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later
```

One exception, third-party: `src/lib/components/ui/**` (vendored shadcn-svelte, MIT).

## Tooling landmines

- Tailwind CSS v4 — utility classes, **no config file**. Don't go looking for one.
- Use sidebar-namespaced design tokens (`sidebar-*`) inside sidebar components.
- Biome cannot parse Svelte 5 `{#snippet}` blocks with TypeScript parameter annotations; it
  reports a syntax error. Leave the annotations off.
- Biome also misses template-only usage of an **aliased** import in a `.svelte` file and
  reports it unused. Import the name unaliased.
- Suppress the getter/setter `bind:prop={() => x, (v) => set(v)}` warning with:
  `// biome-ignore lint/complexity/noCommaOperator: Svelte 5 getter/setter bind syntax`
