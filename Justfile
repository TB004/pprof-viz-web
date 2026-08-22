# Task runner for pprof-viz-web

# Show the available tasks
[group('Utilities')]
default:
    @just --list

# Generate the protobuf types from the .proto files
[group('Build')]
proto:
    bun run proto:gen

# Run the app in development mode
[group('Build')]
dev:
    bun run dev

# Build the static PWA into `build/`
[group('Build')]
build:
    bun run build

# Secure-context features (service workers, OPFS, persistent storage) all treat
# localhost as secure, so the production build behaves here as it does deployed.
[doc('Serve the production build locally, service worker included')]
[group('Build')]
preview:
    bun run preview

# Build the self-hosted container image from source
[group('Container')]
image TAG="pprof-viz-web":
    podman build -t {{ TAG }} -f packaging/web/Containerfile .

# Package an already-built `build/` directory into the container image
[group('Container')]
image-dist TAG="pprof-viz-web": build
    podman build -t {{ TAG }} -f packaging/web/Containerfile.dist .

# Run the container image locally
[group('Container')]
serve PORT="8080" TAG="pprof-viz-web":
    podman run --rm -p {{ PORT }}:80 {{ TAG }}

# Run the type checker
[group('Quality')]
check:
    bun run check

# Lint the sources
[group('Quality')]
lint:
    bunx biome check ./src

# Lint and write fixes
[group('Quality')]
lint-fix:
    bunx biome check --write ./src

# Format the codebase
[group('Quality')]
format:
    bunx biome format --write --css-parse-tailwind-directives=true ./src

# Verify formatting without changing files
[group('Quality')]
format-check:
    bunx biome format --css-parse-tailwind-directives=true ./src

# Run the main verification pipeline
[group('Quality')]
verify: check lint format-check

# Report known vulnerabilities and outdated dependencies
[group('Maintenance')]
vuln:
    - bun audit
    - bun outdated

# Remove build and dependency artifacts
[group('Maintenance')]
clean:
    rm -rf .svelte-kit build node_modules
