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

# Regenerate macOS/Windows/Linux app icons
[group('Build')]
icons:
    - cargo tauri icon src-tauri/icons/icon-source.png --output src-tauri/icons

# Run the SvelteKit type and config checks
[group('Quality')]
check:
    - bun run check

# Run Biome's code quality checks
[group('Quality')]
lint:
    - bunx biome check ./src

# Run Biome's code quality checks and write fixes
[group('Quality')]
lint-fix:
    - bunx biome check --write ./src

# Format the codebase with Biome
[group('Quality')]
format:
    - bunx biome format --write --css-parse-tailwind-directives=true  ./src

# Verify formatting without changing files
[group('Quality')]
format-check:
    - bunx biome format --css-parse-tailwind-directives=true ./src

# Run the main verification pipeline
[group('Quality')]
verify: check lint format-check

# Check dependencies for known vulnerabilities or if they are outdated
[group('Maintenance')]
vuln:
    - bun audit
    - bun outdated

# Remove build and dependency artifacts
[group('Maintenance')]
clean:
    - rm -rf .svelte-kit build node_modules src-tauri/target
