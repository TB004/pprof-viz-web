# <img src="src-tauri/icons/icon.png" alt="pprof-viz logo" height="50" style="vertical-align:middle"> Pprof-Viz

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A modern, real-time desktop dashboard for visualizing Go runtime telemetry.**

## 🔍 Overview

`Pprof-Viz` is a cross-platform desktop application built with **Tauri v2** and **Svelte 5**. It serves as the frontend for the `pprof-viz-agent` backend, providing a comprehensive, real-time visualization of Go's internal `runtime/metrics`.

Unlike standard `pprof` which is designed for ad-hoc, deep-dive stack trace analysis, `Pprof-Viz` is built for **continuous, high-resolution monitoring**. It transforms continuous streams of telemetry data into an intuitive, operator-friendly dashboard, giving you immediate insight into CPU usage, Garbage Collection behavior, memory allocation, and scheduler latencies.

## ✨ Key Features

- **⚡️ Real-Time Telemetry**: Seamlessly streams and visualizes live Go runtime metrics.
- **🕒 Session Awareness**: Persistent shell layout with a session status bar showing active profiling state, elapsed time, and collected samples.
- **📈 Dedicated Dashboards**: Route-based views specifically tailored for CPU, GC, Memory, Scheduler, and Miscellaneous runtime behavior.
- **🎛️ Profile Management**: Built-in collection profile selection and lifecycle controls.
- **🚀 Modern Tech Stack**: Built with Tauri v2, Svelte 5, shadcn-svelte components, and Tailwind CSS v4.
- **🖥️ Native Desktop**: Distributed as `.dmg` (macOS), `.msi` (Windows), and Flatpak (Linux).

## 🛠️ Getting Started

### 📋 Prerequisites

To build and run the app locally, you will need:
- [Bun](https://bun.sh/) (Package Manager)
- [Just](https://github.com/casey/just) (Task Runner)
- [Rust](https://rustup.rs/) (toolchain for the Tauri shell)
- Tauri's platform prerequisites — see [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)
- A running instance of [`pprof-viz-agent`](https://github.com/TB004/pprof-viz-agent)

### 📥 Installation & Development

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Run the desktop app in dev mode:**
   ```bash
   just dev
   ```
   This launches the Tauri app with hot-reload from the Vite dev server.

3. **Build a release bundle for your platform:**
   ```bash
   just build
   ```
   Bundles land under `src-tauri/target/release/bundle/`.

## 🏗️ Architecture & Integration

`Pprof-Viz` is a Tauri v2 desktop app. The Svelte frontend handles the UI; the Rust shell handles persistence (settings store, sqlite for projects/profiles), in-memory collection state, and the ConnectRPC client that talks to the agent.

For a complete monitoring setup:
1. **Embed** the `pprof-viz-agent` in your Go application.
2. **Install** the `Pprof-Viz` desktop app on your machine.
3. **Connect** the app to your Go application's agent endpoint.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
