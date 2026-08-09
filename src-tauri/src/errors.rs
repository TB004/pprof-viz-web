// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

use std::collections::VecDeque;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::state::AppState;
use crate::utils;

const MAX_ERRORS: usize = 200;
pub const EVENT_NEW_ERROR: &str = "error://new";

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub id: String,
    pub message: String,
    #[specta(type = utils::TsNumber)]
    pub timestamp: i64,
}

#[derive(Debug, Default)]
pub struct ErrorLog {
    entries: Mutex<VecDeque<AppError>>,
}

impl ErrorLog {
    pub fn push(&self, message: String) -> AppError {
        let entry = AppError {
            id: ulid::Ulid::generate().to_string(),
            message,
            timestamp: utils::now_millis(),
        };
        let mut entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());
        entries.push_front(entry.clone());
        while entries.len() > MAX_ERRORS {
            entries.pop_back();
        }
        entry
    }

    pub fn snapshot(&self) -> Vec<AppError> {
        self.entries
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .cloned()
            .collect()
    }

    pub fn clear(&self) {
        self.entries
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
    }

    pub fn remove(&self, id: &str) {
        self.entries
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .retain(|entry| entry.id != id);
    }
}

/// Internal helper: push an error and emit it. Used from Rust call sites
/// (collection failures, sql errors, ...) that want to surface a problem.
pub fn report(app: &AppHandle, message: String) {
    let log = app.state::<AppState>().errors.clone();
    let entry = log.push(message);
    let _ = app.emit(EVENT_NEW_ERROR, &entry);
}

#[tauri::command]
#[specta::specta]
pub async fn register_error(app: AppHandle, message: String) -> Result<AppError, String> {
    let log = app.state::<AppState>().errors.clone();
    let entry = log.push(message);
    app.emit(EVENT_NEW_ERROR, &entry)
        .map_err(|e| e.to_string())?;
    Ok(entry)
}

#[tauri::command]
#[specta::specta]
pub async fn get_errors(app: AppHandle) -> Result<Vec<AppError>, String> {
    Ok(app.state::<AppState>().errors.snapshot())
}

#[tauri::command]
#[specta::specta]
pub async fn clear_errors(app: AppHandle) -> Result<(), String> {
    app.state::<AppState>().errors.clear();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn remove_error(app: AppHandle, id: String) -> Result<(), String> {
    app.state::<AppState>().errors.remove(&id);
    Ok(())
}
