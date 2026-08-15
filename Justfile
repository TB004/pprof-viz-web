# Task runner for pprof-viz
#
# Recipe lines are NOT `-`-prefixed: a failing command fails the recipe, so
# `just verify` is a real gate. The only exception is `vuln`, which reports
# rather than gates (see the comment there).

# Show the available tasks
[group('Utilities')]
default:
    @just --list

# Run the Tauri app in development mode
[group('Build')]
dev:
    # `-`: Ctrl-C to quit the app makes cargo exit non-zero, which is not an error here.
    - cargo tauri dev

# Build the Tauri app for the current platform
[group('Build')]
build:
    cargo tauri build

# Build the Linux Flatpak (builds the .deb first)
[group('Build')]
flatpak *ARGS:
    ./scripts/build-flatpak.py {{ ARGS }}

# Regenerate macOS/Windows/Linux app icons
[group('Build')]
icons:
    cargo tauri icon src-tauri/icons/icon-source.png --output src-tauri/icons

# Run the type checkers
[group('Quality')]
check:
    bun run check
    cargo check --manifest-path ./src-tauri/Cargo.toml

# Two independent pairs, each duplicated because no single file can feed both
# consumers:
#   app version — tauri.conf.json feeds `package_info().version` (what the
#     update checker compares against) and the CI artifact names; Cargo.toml
#     feeds the updater's user agent.
#   toolchain — rust-toolchain.toml is what rustup *selects*; Cargo.toml's
#     rust-version is what cargo *enforces*, and it drives MSRV-aware
#     dependency resolution. Cargo never reads the toolchain file, and rustup
#     never reads rust-version, so nothing but this check ties them together.
[doc('Fail if the app version or the pinned Rust toolchain has drifted')]
[group('Quality')]
version-check:
    #!/usr/bin/env bash
    set -euo pipefail
    cargo_version="$(sed -n 's/^version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' src-tauri/Cargo.toml | head -n1)"
    conf_version="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' src-tauri/tauri.conf.json | head -n1)"
    if [[ -z "$cargo_version" || -z "$conf_version" ]]; then
        printf 'could not read a version (Cargo.toml: %s, tauri.conf.json: %s)\n' \
            "${cargo_version:-<none>}" "${conf_version:-<none>}" >&2
        exit 1
    fi
    if [[ "$cargo_version" != "$conf_version" ]]; then
        printf 'version drift: Cargo.toml %s != tauri.conf.json %s\n' \
            "$cargo_version" "$conf_version" >&2
        exit 1
    fi
    cargo_msrv="$(sed -n 's/^rust-version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' src-tauri/Cargo.toml | head -n1)"
    toolchain="$(sed -n 's/^channel[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' rust-toolchain.toml | head -n1)"
    if [[ -z "$cargo_msrv" || -z "$toolchain" ]]; then
        printf 'could not read a toolchain (Cargo.toml: %s, rust-toolchain.toml: %s)\n' \
            "${cargo_msrv:-<none>}" "${toolchain:-<none>}" >&2
        exit 1
    fi
    if [[ "$cargo_msrv" != "$toolchain" ]]; then
        printf 'toolchain drift: Cargo.toml rust-version %s != rust-toolchain.toml channel %s\n' \
            "$cargo_msrv" "$toolchain" >&2
        exit 1
    fi
    printf 'version %s, toolchain %s\n' "$cargo_version" "$toolchain"

# Run code quality checks
[group('Quality')]
lint:
    bunx biome check ./src
    cargo clippy --manifest-path ./src-tauri/Cargo.toml

# Run code quality checks and write fixes
[group('Quality')]
lint-fix:
    bunx biome check --write ./src
    cargo fix --manifest-path ./src-tauri/Cargo.toml --allow-dirty

# Format the codebase
[group('Quality')]
format:
    bunx biome format --write --css-parse-tailwind-directives=true ./src
    cargo fmt --manifest-path ./src-tauri/Cargo.toml --all

# Verify formatting without changing files
[group('Quality')]
format-check:
    bunx biome format --css-parse-tailwind-directives=true ./src
    cargo fmt --check --manifest-path ./src-tauri/Cargo.toml --all

# Run the main verification pipeline
[group('Quality')]
verify: check lint format-check version-check

# Report known vulnerabilities and outdated dependencies.
# `-`: informational only — advisories in transitive dev tooling must not fail
# the build. `verify` is the gate; this is the report.
[group('Maintenance')]
vuln:
    - bun audit
    - bun outdated
    - cargo audit -f ./src-tauri/Cargo.lock

# Regenerate the sqlx offline query data in src-tauri/.sqlx.
[group('Maintenance')]
sqlx-prepare:
    cd src-tauri && export DATABASE_URL="sqlite://$PWD/target/dev.db" && sqlx database create && sqlx migrate run --source migrations && cargo sqlx prepare -- --all-targets

# Remove build and dependency artifacts
[group('Maintenance')]
clean:
    rm -rf .svelte-kit build node_modules src-tauri/target
