// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

mod archive;
mod collection;
mod db;
mod errors;
mod opener;
mod rpc;
mod settings;
mod update;

mod proto {
    connectrpc::include_generated!();
}

use std::sync::Arc;

use tauri::Manager;

use crate::collection::CollectionStore;
use crate::errors::ErrorLog;

/// Process-wide state that is not persisted: the in-memory error log and the
/// active collection session.
#[derive(Debug, Default)]
pub struct AppState {
    pub errors: Arc<ErrorLog>,
    pub collection: Arc<CollectionStore>,
}

/// TypeScript type for an integer that crosses the IPC boundary as a JSON
/// number: epoch millis, byte counts, sample counts.
pub type TsNumber = specta_typescript::Number;

/// Trim an optional user-supplied string, treating a blank result as absent.
pub fn non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn make_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::new()
        .constant("MAX_FRAMES", collection::MAX_FRAMES)
        .constant("MAX_ERRORS", errors::MAX_ERRORS)
        .commands(tauri_specta::collect_commands![
            settings::get_arch,
            settings::get_settings,
            settings::update_settings,
            db::list_projects,
            db::list_profiles,
            db::get_project_by_id,
            db::get_profile_by_id,
            db::create_project,
            db::rename_project,
            db::delete_project,
            db::create_profile,
            db::update_profile,
            db::delete_profile,
            db::reset_all_data,
            errors::register_error,
            errors::get_errors,
            errors::clear_errors,
            errors::remove_error,
            collection::start_collection,
            collection::stop_collection,
            collection::get_collection_snapshot,
            archive::save_collection,
            archive::list_collections,
            archive::delete_collection,
            archive::update_collection,
            archive::load_collection,
            archive::disk_usage,
            rpc::agent_ping,
            update::check_update,
            update::install_update,
            opener::open,
        ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = make_builder();

    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/lib/bindings.ts",
        )
        .expect("failed to export typescript bindings");

    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            // Folder that holds saved `.ppvz` collections.
            std::fs::create_dir_all(data_dir.join("collections"))?;

            let pool = tauri::async_runtime::block_on(
                sqlx::sqlite::SqlitePoolOptions::new().connect_with(
                    sqlx::sqlite::SqliteConnectOptions::new()
                        .filename(data_dir.join("pprof-viz.db"))
                        .create_if_missing(true)
                        .foreign_keys(true)
                        .auto_vacuum(sqlx::sqlite::SqliteAutoVacuum::Full)
                        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal),
                ),
            )?;

            tauri::async_runtime::block_on(sqlx::migrate!("./migrations").run(&pool))?;

            app.manage(pool);
            app.manage(settings::SettingsState::load(&data_dir));

            // Cold-start file open (Windows/Linux pass the path as an argv;
            // macOS delivers it via RunEvent::Opened below instead).
            if let Some(path) = std::env::args_os()
                .skip(1)
                .map(std::path::PathBuf::from)
                .find(|p| {
                    p.extension()
                        .is_some_and(|e| e.eq_ignore_ascii_case("ppvz"))
                })
            {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = archive::load_from_path(&handle, &path).await {
                        errors::report(&handle, format!("failed to open {path:?}: {e}"));
                    }
                });
            }
            Ok(())
        })
        .manage(AppState::default())
        .invoke_handler(builder.invoke_handler())
        .build(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("error while building tauri application: {e}");
            std::process::exit(1);
        })
        .run(|_app_handle, _event| {
            // macOS delivers "Open With" / double-clicked files here.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &_event {
                for url in urls {
                    if let Ok(path) = url.to_file_path()
                        && path
                            .extension()
                            .is_some_and(|e| e.eq_ignore_ascii_case("ppvz"))
                    {
                        let handle = _app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = archive::load_from_path(&handle, &path).await {
                                errors::report(&handle, format!("failed to open {path:?}: {e}"));
                            }
                        });
                    }
                }
            }
        });
}
