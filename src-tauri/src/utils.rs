// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

/// TypeScript type for an integer that crosses the IPC boundary as a JSON
/// number: epoch millis, byte counts, sample counts.
pub type TsNumber = specta_typescript::Number;

pub fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
