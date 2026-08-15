#!/usr/bin/env python3
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
# Requires Python 3.12 or newer (stdlib only).

from __future__ import annotations

import argparse
import json
import platform
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FLATPAK_DIR = REPO_ROOT / "packaging" / "flatpak"
APP_ID = "de.tb004.pprof-viz"
MANIFEST = FLATPAK_DIR / f"{APP_ID}.yml"
BUILD_DIR = REPO_ROOT / "target" / "flatpak" / "build"
REPO_DIR = REPO_ROOT / "target" / "flatpak" / "repo"
STATE_DIR = REPO_ROOT / "target" / "flatpak" / "state"
DIST_DIR = REPO_ROOT / "target" / "flatpak" / "dist"
# The manifest sources the .deb under this fixed name.
STAGED_DEB = FLATPAK_DIR / "pprof-viz.deb"


@dataclass(frozen=True)
class Arch:
    """Flatpak and uname agree on the names (x86_64 / aarch64); Debian and Rust
    do not, so keep the three mappings side by side."""

    flatpak: str
    deb: str
    rust_target: str


ARCHES = {
    "x86_64": Arch("x86_64", "amd64", "x86_64-unknown-linux-gnu"),
    "aarch64": Arch("aarch64", "arm64", "aarch64-unknown-linux-gnu"),
}


def die(message: str) -> None:
    print(f"\033[31merror:\033[0m {message}", file=sys.stderr)
    raise SystemExit(1)


def info(message: str) -> None:
    print(f"\033[34m==>\033[0m {message}")


def run(cmd: list[str], cwd: Path | None = None) -> None:
    try:
        subprocess.run(cmd, cwd=cwd, check=True)
    except subprocess.CalledProcessError as exc:
        die(f"{cmd[0]} failed with exit code {exc.returncode}")


def have(tool: str) -> bool:
    return shutil.which(tool) is not None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="scripts/build-flatpak.py",
        description="Build Pprof-Viz as a Flatpak.",
    )
    parser.add_argument(
        "--arch",
        choices=sorted(ARCHES),
        help="Target architecture (default: host architecture).",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Reuse an existing .deb instead of running cargo tauri.",
    )
    parser.add_argument(
        "--install",
        dest="do_install",
        action="store_true",
        help="Install the built Flatpak into the user installation.",
    )
    parser.add_argument(
        "--bundle",
        dest="do_bundle",
        action="store_true",
        help="Export a single-file .flatpak next to the repo's dist dir.",
    )
    parser.add_argument(
        "--clean",
        dest="do_clean",
        action="store_true",
        help="Wipe the flatpak build/repo directories before building.",
    )
    return parser.parse_args()


def read_runtime_version() -> str:
    pattern = re.compile(r'^runtime-version:\s*"?([^"\s]+)"?\s*$')
    try:
        lines = MANIFEST.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        die(f"could not read {MANIFEST}: {exc}")
    for line in lines:
        match = pattern.match(line)
        if match:
            return match.group(1)
    die(f"could not read runtime-version from {MANIFEST}")
    raise AssertionError  # unreachable, keeps type checkers happy


def read_app_version() -> str:
    config = REPO_ROOT / "src-tauri" / "tauri.conf.json"
    try:
        return json.loads(config.read_text(encoding="utf-8")).get("version") or "unknown"
    except (OSError, json.JSONDecodeError):
        return "unknown"


def check_prerequisites(arch: Arch) -> None:
    for tool in ("flatpak", "flatpak-builder", "ar", "tar"):
        if not have(tool):
            die(f"'{tool}' is not installed")

    runtime_version = read_runtime_version()
    for runtime in ("org.gnome.Platform", "org.gnome.Sdk"):
        ref = f"{runtime}/{arch.flatpak}/{runtime_version}"
        result = subprocess.run(
            ["flatpak", "info", ref],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode != 0:
            die(
                f"missing flatpak runtime {ref}. Install it with:\n"
                f"  flatpak install --user flathub {ref}"
            )


def build_deb(arch: Arch, cross: bool) -> None:
    if not have("cargo"):
        die("'cargo' is not installed")
    tauri = subprocess.run(
        ["cargo", "tauri", "--version"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if tauri.returncode != 0:
        die("'cargo tauri' is not available (cargo install tauri-cli)")

    if cross:
        info(
            f"cross-compiling for {arch.flatpak} — this needs the "
            f"{arch.rust_target} toolchain and matching sysroot"
        )

    info(f"building .deb for {arch.flatpak} ({arch.rust_target})")
    run(
        ["cargo", "tauri", "build", "--bundles", "deb", "--target", arch.rust_target],
        cwd=REPO_ROOT,
    )


def find_deb(arch: Arch) -> Path:
    bundle_dir = (
        REPO_ROOT / "src-tauri" / "target" / arch.rust_target / "release" / "bundle" / "deb"
    )
    if not bundle_dir.is_dir():
        die(f"no deb bundle directory at {bundle_dir}")

    # Pick the newest matching .deb; Tauri names them <product>_<version>_<arch>.deb
    # and leaves older versions behind.
    candidates = sorted(
        bundle_dir.glob(f"*_{arch.deb}.deb"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        die(f"no *_{arch.deb}.deb found in {bundle_dir}")
    return candidates[0]


def main() -> None:
    args = parse_args()

    host_arch = platform.machine()
    arch = ARCHES.get(args.arch or host_arch)
    if arch is None:
        die(
            f"unsupported architecture: {args.arch or host_arch} "
            "(expected x86_64 or aarch64)"
        )
    cross = arch.flatpak != host_arch

    check_prerequisites(arch)

    if args.skip_build:
        info("skipping cargo tauri build (--skip-build)")
    else:
        build_deb(arch, cross)

    deb_file = find_deb(arch)
    info(f"using {deb_file.name}")

    if args.do_clean:
        info(f"cleaning {REPO_ROOT / 'target' / 'flatpak'}")
        for path in (BUILD_DIR, REPO_DIR, STATE_DIR):
            shutil.rmtree(path, ignore_errors=True)

    DIST_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(deb_file, STAGED_DEB)
    try:
        info(f"running flatpak-builder for {arch.flatpak}")
        builder_args = [
            "flatpak-builder",
            "--force-clean",
            "--user",
            f"--arch={arch.flatpak}",
            f"--state-dir={STATE_DIR}",
            f"--repo={REPO_DIR}",
        ]
        if args.do_install:
            builder_args.append("--install")
        run([*builder_args, str(BUILD_DIR), str(MANIFEST)])
    finally:
        # The staged copy is a build input only; don't leave it lying in the
        # source tree.
        STAGED_DEB.unlink(missing_ok=True)

    if args.do_bundle:
        bundle_file = DIST_DIR / f"{APP_ID}-{read_app_version()}-{arch.flatpak}.flatpak"
        info(f"exporting bundle to {bundle_file}")
        run(
            [
                "flatpak",
                "build-bundle",
                f"--arch={arch.flatpak}",
                str(REPO_DIR),
                str(bundle_file),
                APP_ID,
            ]
        )

    info("done")
    if args.do_install:
        print(f"Run it with:\n  flatpak run {APP_ID}")
    else:
        print(f"Install it with:\n  flatpak install --user {REPO_DIR} {APP_ID}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        raise SystemExit(130)
