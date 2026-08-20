// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

use std::process::Command;
use std::time::{Duration, Instant};

/// How long to wait for the launcher to exit before assuming it handed off.
const LAUNCH_TIMEOUT: Duration = Duration::from_secs(2);
const POLL_INTERVAL: Duration = Duration::from_millis(50);

fn launcher(target: &str) -> Result<Command, String> {
    #[cfg(target_os = "macos")]
    {
        let mut cmd = Command::new("open");
        cmd.arg(target);
        Ok(cmd)
    }

    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", target]);
        Ok(cmd)
    }

    #[cfg(target_os = "linux")]
    {
        let mut cmd = Command::new("xdg-open");
        cmd.arg(target);
        Ok(cmd)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = target;
        Err("unsupported platform".into())
    }
}

/// Opens a URL or file path with the OS default handler.
#[tauri::command]
#[specta::specta]
pub async fn open(target: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut child = launcher(&target)?.spawn().map_err(|e| e.to_string())?;
        let deadline = Instant::now() + LAUNCH_TIMEOUT;

        loop {
            match child.try_wait().map_err(|e| e.to_string())? {
                Some(status) if status.success() => return Ok(()),
                Some(status) => {
                    // The codes differ per launcher, so report rather than
                    // interpret; the point is that this stops being silent.
                    return Err(match status.code() {
                        Some(code) => format!("failed to open {target} (exit status {code})"),
                        None => format!("the handler for {target} was terminated by a signal"),
                    });
                }
                // Still running, so it did not fail outright: treat as handed off.
                None if Instant::now() >= deadline => return Ok(()),
                None => std::thread::sleep(POLL_INTERVAL),
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
