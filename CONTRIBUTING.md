# 🤝 Contributing to pprof-viz

First off, thank you for considering contributing to `pprof-viz`! It's people like you who make open-source tools great.

This project is a high-performance frontend for Go runtime telemetry. Our goal is to provide a polished, reliable, and operator-friendly experience for real-time observability.

---

## 🛠️ Getting Started

### Prerequisites
To set up the development environment, you'll need:
- **[Bun](https://bun.sh/)**: Our package manager and runtime.
- **[Just](https://github.com/casey/just)**: Our task runner for common commands.
- **[pprof-viz-agent](https://github.com/TB004/pprof-viz-agent)**: Required if you want to test with live data.

### Local Setup
1. **Clone the repository:**
   ```bash
   git clone https://github.com/TB004/pprof-viz.git
   cd pprof-viz
   ```
2. **Install dependencies:**
   ```bash
   bun install
   ```
3. **Start the development server:**
   ```bash
   just dev
   ```

---

## 🏗️ Technical Architecture

Before you start coding, it's helpful to understand the core pillars of the project:

- **Svelte 5 (Runes)**: We use the latest Svelte 5 syntax (`$state`, `$derived`, `$effect`). Please avoid Svelte 4 patterns.
- **Services Pattern**: All business logic and state management live in `src/lib/services/`. Components should import services directly rather than prop-drilling.
- **Static First**: The app is built with `adapter-static`. All routes are prerendered; there is no Node.js runtime in production.
- **Styling**: We use **Tailwind CSS v4** and **shadcn-svelte** components.

---

## 📜 Development Workflow

We use `just` to ensure consistency across development. Please run these commands before submitting a PR:

| Command | Description |
| :--- | :--- |
| `just dev` | Starts the Vite development server. |
| `just check` | Runs SvelteKit sync and `svelte-check` for type safety. |
| `just lint` | Performs static analysis using Biome. |
| `just format` | Automatically formats code using Biome. |
| `just verify` | **The Golden Rule**: Runs check, lint, and format-check in one go. |

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
2. **Svelte 5 Awareness**: Ensure the AI isn't hallucinating Svelte 4 syntax (like `onMount` or `$:`)—we strictly use Svelte 5 Runes.
3. **Surgical Edits**: Prefer minimal, high-impact changes over large, AI-generated refactors.

---

## 🚀 Submitting a Pull Request

1. **Branching**: Create a feature branch (e.g., `feat/add-memory-chart`).
2. **Commits**: Use clear, imperative messages (e.g., `add: cpu usage sparkline`).
3. **Verification**: Run `just verify` to ensure everything is green.
4. **The PR**: Fill out the template. Include screenshots or screen recordings for any visual changes.

---

## ⚖️ License

By contributing to `pprof-viz`, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).
