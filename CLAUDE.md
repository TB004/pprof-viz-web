# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All quality commands are run via `just` (task runner):

```bash
just dev            # Start Vite dev server (alias: bun run dev)
just build          # Production build → build/
just check          # SvelteKit sync + svelte-check type checking
just lint           # Biome static analysis (read-only)
just lint-fix       # Biome analysis + apply safe auto-fixes
just format         # Biome formatter (write)
just format-check   # Biome formatter (verify only)
just verify         # Full pipeline: check + lint + format-check
just cover          # Run tests with coverage → .test/
just clean          # Remove .svelte-kit/, build/, node_modules/
```

Use `bun` as the package manager (not npm/yarn).

## Debugging

When debugging tooling issues (linters, formatters like Biome, ESLint, Prettier), always check the tool's configuration file first (`biome.json`, `.eslintrc`, etc.) before investigating environment or git issues.

## Architecture

**pprof-viz** is a static SvelteKit 5 PWA that connects to a `pprof-viz-agent` backend to display live Go runtime profiling data (CPU, GC, memory, scheduler). Built with adapter-static — no server, all routes prerendered.

### Shell

`src/routes/+layout.svelte` provides a persistent shell:
- **AppSidebar** (floating) — navigation + profile/collection controls
- **SessionStatusBar** (footer) — live collection metrics (status, URL, mode, samples, elapsed time, error count)
- Page content fills the remaining space

### Routes

Flat structure under `src/routes/`: `cpu/`, `gc/`, `memory/`, `scheduler/`, `miscellaneous/`, `settings/`, and the root index. Each is a placeholder page; runtime data display is the intended content.

### Services (`src/lib/services/`)

Services own all state and business logic. Components import services directly — there is no prop-drilling for shared state.

| Service | Responsibility |
|---|---|
| `CollectionService` | Session lifecycle (idle → running → idle), elapsed timer, collected samples. Exposes `collectionState` (readable store). |
| `ProfileService` | CRUD for projects and profiles stored in IndexedDB. Hydrates on first use. Exposes `profileCatalog`, `profileProjects`, `profileOptions` (derived stores). |
| `DBService` | IndexedDB wrapper (`pprof-viz-profiles` database, `projects` + `profiles` object stores). Promisified IDB operations, lazily opened. |
| `ErrorService` | Central error accumulator. `registerError()` appends timestamped errors; `errorState` is a readable store. |

Services expose **readable interfaces** wrapping internal writable stores — nothing outside the service layer can mutate state directly.

**Snapshot functions** (`getCollectionStateSnapshot()`, `getSnapshot()`) exist for synchronous state reads inside service functions that cannot use reactive subscriptions.

### Component layers

```
src/lib/components/
├── ui/          # shadcn-svelte / bits-ui primitives (button, card, dialog, select, sidebar, …)
└── custom/
    ├── app-sidebar/            # AppSidebar + ProfileChooser
    ├── profile-manager-dialog/ # Full profile/project manager (PMDialog)
    └── session-status-bar/     # Footer status strip + error overlay
```

**ProfileManagerDialog** is the most complex component group. Its shared mutable state lives in `state.svelte.ts` (a `.svelte.ts` module using `$state`) so all sub-components (`PMSidebar`, `PMSidebarElem`, `PMProjectDialog`, `PMDeleteDialog`) can read and write it without prop drilling. Action functions (`openCreateProjectDialog`, `handleProfileSelect`, etc.) are also exported from that module.

### State management

This project uses TypeScript and Svelte 5. When editing Svelte files, always use Svelte 5 runes syntax — **not** Svelte 4 patterns (no `onMount`/`onDestroy` for reactive state, no `$:` reactive statements, no `createEventDispatcher`).

- **Svelte stores** (`writable` / `derived` / `readable`) for service-layer state.
- **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$bindable`, `$props`) for component-local and shared module state.
- Shared cross-component state that doesn't belong in a service lives in co-located `.svelte.ts` files (see `profile-manager-dialog/state.svelte.ts`). Rune syntax (`$state`) only works in `.svelte` and `.svelte.ts` files — **not** plain `.ts` files.

### UI stack

- **Tailwind CSS v4** — utility classes, no config file (configured via Vite plugin)
- **shadcn-svelte** over **bits-ui** headless primitives
- **Tailwind Variants** (`tv()`) for component variant definitions
- **@lucide/svelte** for icons
- Design tokens: `sidebar-*`, `border`, `muted`, `primary`, `destructive`, etc. Use sidebar-namespaced tokens (`text-sidebar-foreground`, `bg-sidebar-accent`) inside sidebar components.

### Linting

Biome is used for linting and formatting. Config is in `biome.json`. Ensure HTML and Svelte file overrides are configured correctly in that file when adding new file type support.

Known constraints:
- Biome cannot parse Svelte 5 `{#snippet}` blocks with TypeScript parameter annotations — formatter will report a syntax error on those files; this is a Biome limitation, not a code bug.
- Svelte template usage of imports is invisible to Biome's script analyser — suppress false-positive `noUnusedImports` warnings with `// biome-ignore lint/correctness/noUnusedImports: used in Svelte template`.
- Svelte 5 getter/setter `bind:prop={() => x, (v) => set(v)}` syntax triggers `noCommaOperator` — suppress with `// biome-ignore lint/complexity/noCommaOperator: Svelte 5 getter/setter bind syntax`.
