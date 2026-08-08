// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

fn main() {
    connectrpc_build::Config::new()
        .files(&["./proto/collector.proto"])
        .includes(&["./proto"])
        .include_file("_connectrpc.rs")
        .compile()
        .expect("failed to compile collector.proto with connectrpc-build");

    tauri_build::build();
}
