# AI Project Context: pprof-viz

This document serves as the foundational mandate for all AI interactions within the `pprof-viz` repository. It provides guidance to all AI agents (e.g., Gemini, Claude Code, GitHub Copilot CLI, Codex) regarding the project's purpose, architecture, and engineering standards to ensure consistency and technical integrity.

## 🚀 Project Overview
`pprof-viz` is a static SvelteKit 5 Progressive Web App (PWA) that connects to a `pprof-viz-agent` backend. It displays live Go runtime profiling data (CPU, GC, memory, scheduler) in a high-performance, real-time dashboard. The app is built with adapter-static — meaning there is no server-side rendering in production, and all routes are prerendered.

### Tech Stack
- **Framework**: SvelteKit (Svelte 5)
- **UI Libraries**: shadcn-svelte, bits-ui
- **Styling**: Tailwind CSS v4, Tailwind Variants
- **Package Manager**: Bun
- **Task Runner**: Just
- **Linting & Formatting**: Biome

## 🏗️ Architecture & Directory Structure

### Shell & Layout
- `src/routes/+layout.svelte` provides a persistent shell:
  - **AppSidebar** (floating): Navigation and profile/collection controls.
  - **SessionStatusBar** (footer): Live collection metrics (status, URL, mode, samples, elapsed time, error count).
  - Page content fills the remaining space.

### Routes
A flat structure under `src/routes/`: `cpu/`, `gc/`, `memory/`, `scheduler/`, `miscellaneous/`, `settings/`, and the root index. Each acts as a placeholder page intended specifically for displaying runtime data.

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

### Component Layers
```
src/lib/components/
├── ui/          # shadcn-svelte / bits-ui primitives (button, card, dialog, select, sidebar, …)
└── custom/
    ├── app-sidebar/            # AppSidebar + ProfileChooser
    ├── profile-manager-dialog/ # Full profile/project manager (PMDialog)
    └── session-status-bar/     # Footer status strip + error overlay
```

**ProfileManagerDialog** is the most complex component group. Its shared mutable state lives in `state.svelte.ts` so all sub-components (`PMSidebar`, `PMSidebarElem`, `PMProjectDialog`, `PMDeleteDialog`) can read and write it without prop drilling. Action functions (`openCreateProjectDialog`, `handleProfileSelect`, etc.) are also exported from that module.

## 🛠️ Development & Commands
All quality and build commands are run via `just` (task runner):

| Task | Command | Description |
| :--- | :--- | :--- |
| **Dev Server** | `just dev` | Start Vite dev server (alias: bun run dev). |
| **Build** | `just build` | Production build → `build/`. |
| **Type Check** | `just check` | SvelteKit sync + svelte-check type checking. |
| **Lint** | `just lint` | Biome static analysis (read-only). |
| **Format** | `just format` | Biome formatter (write). |
| **Verify** | `just verify` | Full pipeline: check + lint + format-check. |
| **Clean** | `just clean` | Remove `.svelte-kit/`, `build/`, `node_modules/`. |

Use `bun` as the package manager (not npm/yarn).

## 📏 Engineering Standards

### State Management
This project uses TypeScript and **Svelte 5**. When editing Svelte files, always use Svelte 5 runes syntax — **not** Svelte 4 patterns (e.g., no `onMount`/`onDestroy` for reactive state, no `$:` reactive statements, no `createEventDispatcher`).

- **Svelte stores** (`writable` / `derived` / `readable`) for service-layer state.
- **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$bindable`, `$props`) for component-local and shared module state.
- Shared cross-component state that doesn't belong in a service lives in co-located `.svelte.ts` files (e.g., `profile-manager-dialog/state.svelte.ts`). Rune syntax (`$state`) only works in `.svelte` and `.svelte.ts` files — **not** plain `.ts` files.

### UI Stack
- **Tailwind CSS v4** — utility classes, no config file (configured via Vite plugin).
- **Design tokens**: `sidebar-*`, `border`, `muted`, `primary`, `destructive`, etc. Use sidebar-namespaced tokens (`text-sidebar-foreground`, `bg-sidebar-accent`) inside sidebar components.

### Linting & Tooling
Biome is used for linting and formatting. Config is in `biome.json`. Ensure HTML and Svelte file overrides are configured correctly in that file when adding new file type support.

**Known Constraints:**
- Biome cannot parse Svelte 5 `{#snippet}` blocks with TypeScript parameter annotations — the formatter will report a syntax error on those files; this is a Biome limitation, not a code bug.
- Svelte template usage of imports is invisible to Biome's script analyser — suppress false-positive `noUnusedImports` warnings with `// biome-ignore lint/correctness/noUnusedImports: used in Svelte template`.
- Svelte 5 getter/setter `bind:prop={() => x, (v) => set(v)}` syntax triggers `noCommaOperator` — suppress with `// biome-ignore lint/complexity/noCommaOperator: Svelte 5 getter/setter bind syntax`.
- When debugging tooling issues (linters, formatters like Biome, ESLint, Prettier), always check the tool's configuration file first (`biome.json`, `.eslintrc`, etc.) before investigating environment or git issues.

## 🤖 AI Interaction Guidelines
- **Verify Logic**: Contributions can be AI-assisted, but all code must be verified for correctness.
- **Modern Svelte Practices**: Adhere strictly to Svelte 5 paradigms.
- **No Prop Drilling**: Use services and shared `.svelte.ts` files for state management.
