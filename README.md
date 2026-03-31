# pprof-viz

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Docker Hub image: [tb004/pprof-viz](https://hub.docker.com/r/tb004/pprof-viz)

The Docker Hub repository includes the published image and a short overview with example `docker run` and Compose usage.

## Description

`pprof-viz` is a Svelte 5 PWA for exploring and visualizing real-time Go runtime telemetry exposed by the `pprof-viz-agent` backend. It is designed as a dashboard-style frontend for continuous profiling rather than ad-hoc stack-trace inspection, with a strong focus on readability, session awareness, and a compact operator-friendly UI.

The app presents runtime data through a persistent shell layout with a sidebar, route-level views for runtime categories, and a bottom session bar that shows the active profiling state. It is intended to sit in front of a Go telemetry service that streams `runtime/metrics` data via ConnectRPC.

## Overview

The backend agent collects Go runtime metrics with high fidelity and low overhead. This frontend consumes that telemetry and turns it into a visual, session-based interface for monitoring CPU, GC, memory, scheduler, and miscellaneous runtime behavior over time.

The project is built as a PWA so it can behave like an installable desktop app while still being served from the web.

## Features

- Persistent shell layout with a floating sidebar and app-wide session status bar.
- Route-based runtime views for CPU, GC, memory, scheduler, miscellaneous, and settings.
- Collection profile selection and collection lifecycle controls.
- Live session indicators for status, target URL, mode, collected samples, elapsed time, and error state.
- Installable PWA experience with a web app manifest and service worker support.
- Built with Svelte 5, shadcn-svelte-style components, and Tailwind CSS v4.

## Backend

This frontend is designed to visualize data from `pprof-viz-agent`, a Go telemetry backend that exposes `runtime/metrics` over ConnectRPC.

The agent focuses on:

- High-fidelity runtime metrics for GC, scheduler, memory, and CPU behavior.
- Continuous streaming rather than manual one-off profiling.
- Low overhead collection.
- Efficient transport and bandwidth optimization.

## Getting Started

### Prerequisites

- Bun
- Just
- A running `pprof-viz-agent` backend

### Install dependencies

```bash
bun install
```

### Run the development server

```bash
bun dev
```

### Build for production

```bash
bun run build
```

### Preview the production build

```bash
bun run preview
```

## Development Notes

- The profiling session state is managed centrally in `src/lib/services/collection_service.ts`.
- The main app shell lives in `src/routes/+layout.svelte`.
- The status bar is intended to reflect the current collection session at all times.

## Deployment

This app is built as a static frontend and can be deployed behind any web server or CDN that serves the generated build output.

For a complete visualization setup, deploy it alongside a `pprof-viz-agent` backend and configure the frontend to connect to the backend endpoint used by your deployment.

## License

MIT
