# Task runner for pprof-viz

# Show the available tasks
[group('Utilities')]
default:
    @just --list

# Run the Tauri app in development mode
[group('Build')]
dev:
    - cargo tauri dev

# Build the Tauri app for the current platform
[group('Build')]
build:
    - cargo tauri build

# Build the Linux Flatpak (builds the .deb first)
[group('Build')]
flatpak *ARGS:
    - ./scripts/build-flatpak.sh {{ ARGS }}

# Regenerate macOS/Windows/Linux app icons
[group('Build')]
icons:
    - cargo tauri icon src-tauri/icons/icon-source.png --output src-tauri/icons

# Run the type checkers
[group('Quality')]
check:
    - bun run check
    - cargo check --manifest-path ./src-tauri/Cargo.toml

# Run code quality checks
[group('Quality')]
lint:
    - bunx biome check ./src
    - cargo clippy --manifest-path ./src-tauri/Cargo.toml

# Run code quality checks and write fixes
[group('Quality')]
lint-fix:
    - bunx biome check --write ./src
    - cargo fix --manifest-path ./src-tauri/Cargo.toml --allow-dirty

# Format the codebase
[group('Quality')]
format:
    - bunx biome format --write --css-parse-tailwind-directives=true  ./src
    - cargo fmt --manifest-path ./src-tauri/Cargo.toml --all

# Verify formatting without changing files
[group('Quality')]
format-check:
    - bunx biome format --css-parse-tailwind-directives=true ./src
    - cargo fmt --check --manifest-path ./src-tauri/Cargo.toml --all

# Run the main verification pipeline
[group('Quality')]
verify: check lint format-check

# Check dependencies for known vulnerabilities or if they are outdated
[group('Maintenance')]
vuln:
    - bun audit
    - bun outdated
    - cargo audit -f ./src-tauri/Cargo.lock

# Remove build and dependency artifacts
[group('Maintenance')]
clean:
    - rm -rf .svelte-kit build node_modules src-tauri/target
