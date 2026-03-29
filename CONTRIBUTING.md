# Contributing to pprof-viz

Thank you for taking the time to contribute to `pprof-viz`. This project is the frontend for a Go runtime telemetry visualization platform, so contributions should prioritize clarity, reliability, and a polished user experience.

## What This Project Is

`pprof-viz` is a Svelte 5 PWA that visualizes runtime telemetry from the `pprof-viz-agent` backend. The app is centered around:

- A persistent shell layout with navigation and session status
- Route-based runtime dashboards
- A profiling session model that stays visible throughout the app
- A desktop-like, operator-friendly interface

Contributions should preserve that direction.

## Expectations

### Code Quality

- Prefer small, focused changes with a clear purpose.
- Keep the code idiomatic for Svelte 5, TypeScript, and the component patterns already used in the repository.
- Avoid introducing abstractions that do not pull their weight.
- Match the existing styling and layout language unless the task explicitly calls for a redesign.

### UI and UX

- Treat the interface as a product, not just a set of components.
- Preserve the app shell, sidebar behavior, and session visibility patterns.
- Make states explicit: loading, idle, running, empty, and error states should be intentional.
- If you change visible behavior, verify how it behaves in both light and dark themes.

### AI-Assisted Work

- AI tools are fine to use.
- Do not trust generated code blindly.
- Review, test (if necessary), and correct every change before submitting it.
- You are responsible for the final result.

## Setup

### Prerequisites

- Bun
- Just (to make use of the Justfile)
- The `pprof-viz-agent` backend if you want to test live data flows locally

### Install Dependencies

```bash
bun install
```

### Run the App

```bash
bun dev
```

### Type and Config Checks

```bash
just check
```

### Linting

```bash
just lint
```

### Formatting

```bash
just format
```

### Full Verification

```bash
just verify
```

### Coverage

```bash
just cover
```

### Dependency Audit

```bash
just vuln
```

## Workflow

1. Create a branch for your work.
2. Make the smallest complete change that solves the problem.
3. Verify the result locally.
4. Update or add documentation when the user-facing behavior changes.
5. Open a pull request using the repository template.

## Testing Expectations

A contribution is not complete until it has been verified.

- Add or update tests when the behavior changes (if necessary).
- For UI changes, confirm the layout and interactions in the browser.
- For state changes, verify the affected session behavior manually or with checks where appropriate.

## Commit Guidance

- Use concise, imperative commit messages.
- Keep each commit focused on a single logical change.
- Reference related issues when it helps review context.

## Pull Requests

Please fill out the pull request template completely and describe:

- What changed
- Why it changed
- How you verified it
- Any follow-up work that may still be needed

If your change affects the visual layout, it might be good to include screenshots when possible.

## Documentation

If you add a new feature, change a workflow, or alter a visible interaction, update the relevant documentation in the same change.

## License

By contributing, you agree that your changes will be licensed under the project’s MIT License.
