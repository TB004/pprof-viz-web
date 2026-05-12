# 🤝 Contributing to Pprof-Viz

First off, thank you for considering contributing to `Pprof-Viz`! It's people like you who make open-source tools great.

This project is a high-performance desktop frontend for Go runtime telemetry. Our goal is to provide a polished, reliable, and operator-friendly experience for real-time observability.

---

## 🛠️ Getting Started

### Prerequisites
To set up the development environment, you'll need:
- **[Rust](https://rustup.rs/)**: The toolchain for the Tauri backend.
- **Tauri Prerequisites**: OS-specific build tools (C++ build tools on Windows, Xcode command line tools on macOS, webkit2gtk on Linux). See [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/).
- **[Bun](https://bun.sh/)**: Our frontend package manager and runtime.
- **[Just](https://github.com/casey/just)**: Our task runner for common commands.
- **[pprof-viz-agent](https://github.com/TB004/pprof-viz-agent)**: Required if you want to test with live data.

### Local Setup
1. **Clone the repository:**
   ```bash
   git clone https://github.com/TB004/pprof-viz.git
   cd pprof-viz
   ```
2. **Install frontend dependencies:**
   ```bash
   bun install
   ```
3. **Start the development environment:**
   ```bash
   just dev
   ```
   This will spin up the Vite dev server and launch the Tauri desktop application.

---

## 🏗️ Technical Architecture

Before you start coding, it's critical to understand the separation of concerns in this project:

- **Tauri v2 (Rust Backend)**: The `src-tauri` directory acts as the brain. It handles local persistence (SQLite for projects/profiles), the ConnectRPC client, and the in-memory state of active profiling collections. 
- **Svelte 5 (Frontend)**: The `src` directory is a thin, reactive presentation layer built with Svelte 5 Runes (`$state`, `$derived`). It communicates with the backend exclusively via Tauri IPC (`invoke` and `listen`).
- **Styling**: We use **Tailwind CSS v4** and **shadcn-svelte** components.

---

## 📜 Development Workflow

We use `just` to ensure consistency across development. The commands are unified to handle both the Svelte frontend and Rust backend simultaneously. Please run these commands before submitting a PR:

| Command | Description |
| :--- | :--- |
| `just dev` | Starts the Tauri application with frontend hot-reloading. |
| `just check` | Runs SvelteKit sync, `svelte-check`, and `cargo check`. |
| `just lint` | Performs static analysis using Biome (frontend) and Clippy (backend). |
| `just format` | Automatically formats code using Biome and `cargo fmt`. |
| `just verify` | Runs check, lint, and format-check across the entire stack in one go. |

---

## 🎨 UI & UX Guidelines

- **Operator-Friendly**: The UI is designed for long-running monitoring. Keep it compact, readable, and focused.
- **State Transparency**: Always consider how your change looks in **Loading**, **Error**, **Empty**, and **Idle** states.
- **Theme Support**: Verify all UI changes in both **Light** and **Dark** modes.
- **Persistent Shell**: Do not break the layout of the floating sidebar or the bottom session status bar; these should remain consistent across all routes.

---

## 🤖 AI-Assisted Contributions

We welcome the use of AI tools (Gemini, Claude, Copilot, etc.) to help you write code, but we ask that you follow these rules:
1. **No "Vibe-Coding"**: Understand the code the AI generates. You are responsible for every line you submit.
2. **Know the Split**: Ensure the AI puts business/network logic in Rust and UI state in Svelte.
3. **Svelte 5 Awareness**: Ensure the AI isn't hallucinating Svelte 4 syntax (like `onMount` or `$:`)—we strictly use Svelte 5 Runes.
4. **Surgical Edits**: Prefer minimal, high-impact changes over large, AI-generated refactors.

---

## 🚀 Submitting a Pull Request

1. **Branching**: Create a feature branch (e.g., `feat/add-memory-chart`).
2. **Commits**: Use clear, imperative messages (e.g., `add: cpu usage sparkline`).
3. **Verification**: Run `just verify` to ensure everything is green (it automatically checks both Rust and Svelte).
4. **The PR**: Fill out the template. Include screenshots or screen recordings for any visual changes.

---

## ⚖️ License

By contributing to `Pprof-Viz`, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).