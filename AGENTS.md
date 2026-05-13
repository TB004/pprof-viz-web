# AI Project Context: pprof-viz

This document serves as the foundational mandate for all AI interactions within the `pprof-viz` repository. It provides guidance to all AI agents (e.g., Gemini, Claude Code, GitHub Copilot CLI, Codex) regarding the project's purpose, architecture, and engineering standards to ensure consistency and technical integrity.

## 🚀 Project Overview

`Pprof-Viz` is a cross-platform desktop application built with **Tauri v2** and **Svelte 5**. It connects to a `pprof-viz-agent` backend to display live Go runtime profiling data (CPU, GC, memory, scheduler) in a high-performance, real-time dashboard.

The heavy lifting (persistence, ConnectRPC client, and collection state) is handled by the Rust backend, while the Svelte frontend focuses purely on UI and presentation.

### Tech Stack

- **Desktop Shell (Backend)**: Rust, Tauri v2, SQLite
- **Frontend Framework**: SvelteKit (Svelte 5, adapter-static)
- **UI Libraries**: shadcn-svelte, bits-ui
- **Styling**: Tailwind CSS v4, Tailwind Variants
- **Package Managers**: Bun (Frontend), Cargo (Backend)
- **Task Runner**: Just
- **Linting & Formatting**: Biome (Frontend), Clippy/Rustfmt (Backend)

## 🏗️ Architecture & Directory Structure

### Backend (`src-tauri/`)

The Rust shell is the brain of the application. It is responsible for:

- **Persistence**: Projects, profiles, and historical data are stored in a local SQLite database. Settings and configurations use Tauri's key-value store.
- **Telemetry Client**: A ConnectRPC client written in Rust talks to the remote `pprof-viz-agent`.
- **State Management**: The active collection session, metrics buffering, and elapsed timers are managed in Rust memory to ensure performance and prevent browser tab throttling issues.
- **IPC (Inter-Process Communication)**: Exposes Tauri commands (`#[tauri::command]`) to the frontend for CRUD operations and session control, and emits events to push real-time metric updates to the UI.

### Frontend (`src/`)

The Svelte frontend is a thin, reactive presentation layer.

- `src/routes/+layout.svelte` provides a persistent shell (AppSidebar and SessionStatusBar).
- Route-based dashboards (`cpu/`, `gc/`, `memory/`, `scheduler/`, etc.) display the data.
- **Services/Stores**: Frontend services act as thin wrappers around Tauri IPC commands (`invoke`) and event listeners (`listen`), managing the reactive Svelte state to drive the UI.

### Component Layers

```text
src/lib/components/
├── ui/          # shadcn-svelte / bits-ui primitives
└── custom/
    ├── app-sidebar/            # AppSidebar + ProfileChooser
    ├── profile-manager-dialog/ # Profile/project manager UI
    └── session-status-bar/     # Footer status strip
```

State shared across complex component groups (like `ProfileManagerDialog`) lives in co-located `.svelte.ts` files using Svelte 5 runes (`$state`).

## 🛠️ Development & Commands

All quality and build commands are run via `just` (task runner). These commands are unified to handle **both** the Svelte frontend and the Rust backend simultaneously:

| Task | Command | Description |
| :--- | :--- | :--- |
| **Dev Mode** | `just dev` | Starts Vite dev server + Tauri window with hot-reload. |
| **Build** | `just build` | Compiles the frontend and builds the release Tauri binary. |
| **Type Check** | `just check` | SvelteKit sync, svelte-check, and `cargo check`. |
| **Lint** | `just lint` | Biome static analysis and `cargo clippy`. |
| **Format**| `just format` | Biome format and `cargo fmt`. |
| **Verify** | `just verify` | Runs the full pipeline: check, lint, and format-check. |
| **Security** | `just vuln` | Dependency audits (`bun audit`, `cargo audit`). |

## 📏 Engineering Standards

### Rust (Backend)

- Use standard idiomatic Rust. Handle `Result` and `Option` properly; avoid `.unwrap()` or `.expect()` in production paths.
- Tauri commands should return `Result<T, String>` (or a custom serializable Error type) to gracefully pass errors to the Svelte frontend.
- Keep blocking operations off the main thread; use `tauri::async_runtime` or `std::thread` for heavy lifting or the ConnectRPC stream loop.

### Svelte 5 (Frontend)

- Use TypeScript and **Svelte 5 runes syntax** (`$state`, `$derived`, `$effect`, `$bindable`, `$props`). Do not use Svelte 4 patterns (no `onMount` for reactive state, no `$:` reactive statements).
- Extract shared mutable state into `.svelte.ts` files.
- Communicate with the backend strictly via `@tauri-apps/api/core` (`invoke`) and `@tauri-apps/api/event` (`listen`).

### UI Stack

- **Tailwind CSS v4** — utility classes, no config file.
- **Design tokens**: `sidebar-*`, `border`, `muted`, `primary`, `destructive`, etc. Use sidebar-namespaced tokens inside sidebar components.

### Linting & Tooling Constraints

- Biome cannot parse Svelte 5 `{#snippet}` blocks with TypeScript parameter annotations (syntax error).
- Suppress Svelte 5 getter/setter `bind:prop={() => x, (v) => set(v)}` syntax warnings with `// biome-ignore lint/complexity/noCommaOperator: Svelte 5 getter/setter bind syntax`.

## 🤖 AI Interaction Guidelines

- **Verify Logic**: Contributions can be AI-assisted, but all code must be verified for correctness.
- **Understand the Split**: Know whether a feature belongs in Rust (business logic, network, disk) or Svelte (presentation, UI state).
- **No Prop Drilling**: Use `.svelte.ts` shared state for complex component trees.
