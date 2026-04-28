# 📊 pprof-viz

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Image Version](https://img.shields.io/docker/v/tb004/pprof-viz?sort=semver)](https://hub.docker.com/r/tb004/pprof-viz)

**A modern, real-time dashboard for visualizing Go runtime telemetry.**

## 🔍 Overview

`pprof-viz` is a high-performance Progressive Web App (PWA) built with **Svelte 5**. It serves as the frontend for the `pprof-viz-agent` backend, providing a comprehensive, real-time visualization of Go's internal `runtime/metrics`.

Unlike standard `pprof` which is designed for ad-hoc, deep-dive stack trace analysis, `pprof-viz` is built for **continuous, high-resolution monitoring**. It transforms continuous streams of telemetry data into an intuitive, operator-friendly dashboard, giving you immediate insight into CPU usage, Garbage Collection behavior, memory allocation, and scheduler latencies.

## ✨ Key Features

- **⚡️ Real-Time Telemetry**: Seamlessly streams and visualizes live Go runtime metrics.
- **🕒 Session Awareness**: Persistent shell layout with a session status bar showing active profiling state, elapsed time, and collected samples.
- **📈 Dedicated Dashboards**: Route-based views specifically tailored for CPU, GC, Memory, Scheduler, and Miscellaneous runtime behavior.
- **🎛️ Profile Management**: Built-in collection profile selection and lifecycle controls.
- **🚀 Modern Tech Stack**: Built with Svelte 5, shadcn-svelte components, and Tailwind CSS v4 for a fluid, responsive UI.
- **📱 PWA Ready**: Installable as a desktop application with web app manifest and service worker support.

## 🛠️ Getting Started

### 📋 Prerequisites

To build and run the frontend locally, you will need:
- [Bun](https://bun.sh/) (Package Manager)
- [Just](https://github.com/casey/just) (Task Runner)
- A running instance of [`pprof-viz-agent`](https://github.com/TB004/pprof-viz-agent)

### 📥 Installation & Development

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Run the development server:**
   ```bash
   just dev
   ```
   This will start the Vite dev server. Open your browser to the local URL provided in the terminal.

3. **Build for production:**
   ```bash
   just build
   ```
   This generates static files in the `build/` directory.

4. **Preview the production build:**
   ```bash
   bun run preview
   ```

## 🐳 Docker

A pre-built Docker image is available on Docker Hub, making it easy to deploy alongside your backend services.

```bash
docker run -p 8080:80 tb004/pprof-viz:latest
```

Check out the [Docker Hub repository](https://hub.docker.com/r/tb004/pprof-viz) for more details and Docker Compose examples.

## 🏗️ Architecture & Integration

`pprof-viz` is a static Single Page Application (SPA/PWA) that connects directly from the user's browser to the target `pprof-viz-agent` via ConnectRPC.

For a complete monitoring setup:
1. **Embed** the `pprof-viz-agent` in your Go application.
2. **Deploy** the `pprof-viz` static frontend (via Docker, GitHub Pages, Vercel, or any static file server).
3. **Connect** the frontend to your Go application's agent endpoint.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
