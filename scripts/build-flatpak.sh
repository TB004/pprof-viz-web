#!/usr/bin/env bash
# Copyright (C) 2026 Tizian Bahr
# SPDX-License-Identifier: GPL-3.0-or-later

#
# Build Pprof-Viz as a Flatpak.
#
# The Flatpak manifest does not compile anything: it unpacks the Debian package
# produced by Tauri. So this script runs `cargo tauri build --bundles deb`
# first, stages the resulting .deb next to the manifest, and then hands over to
# flatpak-builder.
#
# Usage:
#   scripts/build-flatpak.sh [options]
#
# Options:
#   --arch <x86_64|aarch64>  Target architecture (default: host architecture).
#   --skip-build             Reuse an existing .deb instead of running cargo tauri.
#   --install                Install the built Flatpak into the user installation.
#   --bundle                 Export a single-file .flatpak next to the repo's dist dir.
#   --clean                  Wipe the flatpak build/repo directories before building.
#   -h, --help               Show this help.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLATPAK_DIR="$REPO_ROOT/packaging/flatpak"
APP_ID="de.tb004.pprof_viz"
MANIFEST="$FLATPAK_DIR/$APP_ID.yml"
BUILD_DIR="$REPO_ROOT/target/flatpak/build"
REPO_DIR="$REPO_ROOT/target/flatpak/repo"
STATE_DIR="$REPO_ROOT/target/flatpak/state"
DIST_DIR="$REPO_ROOT/target/flatpak/dist"
# The manifest sources the .deb under this fixed name.
STAGED_DEB="$FLATPAK_DIR/pprof-viz.deb"

ARCH=""
SKIP_BUILD=0
DO_INSTALL=0
DO_BUNDLE=0
DO_CLEAN=0

die() {
    printf '\033[31merror:\033[0m %s\n' "$*" >&2
    exit 1
}

info() {
    printf '\033[34m==>\033[0m %s\n' "$*"
}

usage() {
    # Print the header comment block, minus the shebang.
    sed -n '2,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^#\{1,\} \{0,1\}//;s/^#$//'
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --arch)
            [[ $# -ge 2 ]] || die "--arch requires a value"
            ARCH="$2"
            shift 2
            ;;
        --arch=*)
            ARCH="${1#*=}"
            shift
            ;;
        --skip-build)
            SKIP_BUILD=1
            shift
            ;;
        --install)
            DO_INSTALL=1
            shift
            ;;
        --bundle)
            DO_BUNDLE=1
            shift
            ;;
        --clean)
            DO_CLEAN=1
            shift
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        *)
            die "unknown argument: $1 (try --help)"
            ;;
    esac
done

# --- Architecture resolution ------------------------------------------------
# Flatpak and uname agree on the names (x86_64 / aarch64); Debian and Rust do
# not, so keep the three mappings side by side.

HOST_ARCH="$(uname -m)"
[[ -n "$ARCH" ]] || ARCH="$HOST_ARCH"

case "$ARCH" in
    x86_64 | amd64)
        ARCH="x86_64"
        DEB_ARCH="amd64"
        RUST_TARGET="x86_64-unknown-linux-gnu"
        ;;
    aarch64 | arm64)
        ARCH="aarch64"
        DEB_ARCH="arm64"
        RUST_TARGET="aarch64-unknown-linux-gnu"
        ;;
    *)
        die "unsupported architecture: $ARCH (expected x86_64 or aarch64)"
        ;;
esac

CROSS=0
[[ "$ARCH" == "$HOST_ARCH" ]] || CROSS=1

# --- Prerequisites ----------------------------------------------------------

for tool in flatpak flatpak-builder ar tar; do
    command -v "$tool" >/dev/null 2>&1 || die "'$tool' is not installed"
done

RUNTIME_VERSION="$(sed -n 's/^runtime-version:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}[[:space:]]*$/\1/p' "$MANIFEST")"
[[ -n "$RUNTIME_VERSION" ]] || die "could not read runtime-version from $MANIFEST"

for runtime in "org.gnome.Platform" "org.gnome.Sdk"; do
    if ! flatpak info "$runtime/$ARCH/$RUNTIME_VERSION" >/dev/null 2>&1; then
        die "missing flatpak runtime $runtime/$ARCH/$RUNTIME_VERSION. Install it with:
  flatpak install --user flathub $runtime/$ARCH/$RUNTIME_VERSION"
    fi
done

# --- Build the .deb ---------------------------------------------------------

BUNDLE_DIR="$REPO_ROOT/src-tauri/target/$RUST_TARGET/release/bundle/deb"

if [[ $SKIP_BUILD -eq 0 ]]; then
    command -v cargo >/dev/null 2>&1 || die "'cargo' is not installed"
    cargo tauri --version >/dev/null 2>&1 || die "'cargo tauri' is not available (cargo install tauri-cli)"

    if [[ $CROSS -eq 1 ]]; then
        info "cross-compiling for $ARCH — this needs the $RUST_TARGET toolchain and matching sysroot"
    fi

    info "building .deb for $ARCH ($RUST_TARGET)"
    (cd "$REPO_ROOT" && cargo tauri build --bundles deb --target "$RUST_TARGET")
else
    info "skipping cargo tauri build (--skip-build)"
fi

[[ -d "$BUNDLE_DIR" ]] || die "no deb bundle directory at $BUNDLE_DIR"

# Pick the newest matching .deb; Tauri names them <product>_<version>_<arch>.deb
# and leaves older versions behind.
DEB_FILE="$(find "$BUNDLE_DIR" -maxdepth 1 -name "*_${DEB_ARCH}.deb" -printf '%T@ %p\n' 2>/dev/null |
    sort -rn | head -n1 | cut -d' ' -f2-)"
[[ -n "$DEB_FILE" ]] || die "no *_${DEB_ARCH}.deb found in $BUNDLE_DIR"

info "using $(basename "$DEB_FILE")"

# --- Stage and build the flatpak -------------------------------------------

if [[ $DO_CLEAN -eq 1 ]]; then
    info "cleaning $REPO_ROOT/target/flatpak"
    rm -rf "$BUILD_DIR" "$REPO_DIR" "$STATE_DIR"
fi

mkdir -p "$DIST_DIR"
cp -f "$DEB_FILE" "$STAGED_DEB"
# The staged copy is a build input only; don't leave it lying in the source tree.
trap 'rm -f "$STAGED_DEB"' EXIT

info "running flatpak-builder for $ARCH"
BUILDER_ARGS=(
    --force-clean
    --user
    --arch="$ARCH"
    --state-dir="$STATE_DIR"
    --repo="$REPO_DIR"
)
[[ $DO_INSTALL -eq 1 ]] && BUILDER_ARGS+=(--install)

flatpak-builder "${BUILDER_ARGS[@]}" "$BUILD_DIR" "$MANIFEST"

if [[ $DO_BUNDLE -eq 1 ]]; then
    VERSION="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
        "$REPO_ROOT/src-tauri/tauri.conf.json" | head -n1)"
    BUNDLE_FILE="$DIST_DIR/$APP_ID-${VERSION:-unknown}-$ARCH.flatpak"
    info "exporting bundle to $BUNDLE_FILE"
    flatpak build-bundle --arch="$ARCH" "$REPO_DIR" "$BUNDLE_FILE" "$APP_ID"
fi

info "done"
if [[ $DO_INSTALL -eq 1 ]]; then
    printf 'Run it with:\n  flatpak run %s\n' "$APP_ID"
else
    printf 'Install it with:\n  flatpak install --user %s %s\n' "$REPO_DIR" "$APP_ID"
fi
