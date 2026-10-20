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

Everything runs in the browser. The layers, innermost first:

- `src/lib/utils` — pure logic with no platform dependency. `frames.ts` holds the merge/diff
  algorithms and is shared by the collection worker and the archive.
- `src/lib/storage` — thin wrappers over IndexedDB, OPFS and `localStorage`.
- `src/lib/rpc` — a Connect client (`@connectrpc/connect-web`) speaking the binary protobuf
  codec, the same as the desktop app. `src/lib/proto/gen` is generated; never hand-edit it.
- `src/lib/data`, `src/lib/archive`, `src/lib/collection` — repositories, the `.ppvz` container
  and the collection session.
- `src/lib/services` — the only layer the UI imports. One class per domain, holding reactive
  `$state`. The classes take their stores and their peer services as constructor arguments;
  `services/app.svelte.ts` wires the one instance of each for the tab and is what components
  import (`collectionService`, `archiveService`, …). Never construct a service in a component:
  a second instance owns state nothing renders and, for the session, a second worker.
  `ServiceWorkerService` lives here too, even though it wraps a browser API rather than a
  store: it is what the UI binds to for the "update available" prompt.

Components must not reach past `services` into `data`/`rpc`/`storage`.

## Things that will bite you

- **The collection session runs in a Web Worker** (`src/lib/collection/worker.ts`). Merging a
  frame walks every histogram in the sample, and doing that on the main thread lands on the
  same frame budget the charts repaint in. The worker holds only the previous merged frame;
  the rolling buffer lives in the service, which the UI needs anyway.
- **Elapsed time is derived from `Date.now()`, never from counted ticks.** A backgrounded tab
  throttles `setInterval` to once a minute; the displayed figure has to survive that.
- **Frames arrive as sparse deltas.** Histograms stream only the buckets that moved
  (`updatedCounts`), and unchanged fields are omitted. Always go through `mergeFrame` — even
  for the first frame and for snapshot mode, which is what normalises histograms to dense
  `counts`.
- **`proto/collector.proto` is a shared contract, not a local file.** The Rust desktop app
  compiles against the same schema. Change it there and here together, run `just proto`, and
  commit the regenerated client — CI fails if it is stale.
- **Protobuf maps `uint64` to `bigint`.** Read with `Number(x ?? 0)` at the point of display.
  `JSON.stringify` throws on bigint, so anything that serializes a frame for display needs a
  replacer. Decoded messages also carry a `$typeName` key that is not payload — skip keys
  starting with `$` when iterating a group's fields.
- **`.ppvz` is byte-compatible with the desktop app**: a zstd frame wrapping a protobuf
  `StoredCollection`, with no wrapper header of ours. Do not add one. zstd has no browser
  API, so it is carried as WebAssembly (`src/lib/archive/zstd.ts`), which is why the CSP in
  `packaging/Caddyfile` needs `wasm-unsafe-eval`.
- **The zstd wasm module is per-document, and its results are views into its
  heap.** `ZstdCompressor` therefore shares one loaded module across the tab and
  copies every result: calling the module's `init()` again re-instantiates it
  underneath whatever is already using it, and a result held across the next
  compress or decompress reads back as zeroes. For the same reason there is one
  `Archive` for the tab, built in `services/app.svelte.ts` and injected.
- **The browser owns TLS and the HTTP version.** There is no per-profile "allow invalid
  certificates" or HTTP/3 toggle here, and there cannot be. A collector must present a trusted
  certificate and send CORS headers.
- **`src/service-worker.ts` is excluded from `tsconfig`** by SvelteKit and is compiled
  separately; it uses `/// <reference lib="webworker" />` rather than the app's lib set.
  SvelteKit registers it for you — only production builds have one, so `just dev` always
  reports offline support as unavailable; use `just preview` to exercise it. Applying an
  update is a two-step handshake: `ServiceWorkerService` posts `{ type: "skip-waiting" }` to
  the waiting worker and reloads from the `controllerchange` event, not from the post.
- Settings live in `localStorage`, not IndexedDB, because the inline script in `app.html` reads
  the theme synchronously before first paint. Both sides use the key `pprof-viz-settings`.

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
