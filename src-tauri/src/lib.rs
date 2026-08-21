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

/// The command list, grouped by the service each command belongs to.
macro_rules! services {
    ($(
        $service:literal {
            $(consts: [$($const_name:literal => $const_value:expr),* $(,)?],)?
            commands: [$($module:ident :: $command:ident),* $(,)?] $(,)?
        }
    ),* $(,)?) => {
        fn make_builder() -> tauri_specta::Builder<tauri::Wry> {
            tauri_specta::Builder::new()
                .commands(tauri_specta::collect_commands![$($($module::$command),*),*])
        }

        /// Write one TypeScript module per service into `src/lib/generated/`.
        #[cfg(debug_assertions)]
        fn export_service_bindings() {
            $(
                tauri_specta::Builder::<tauri::Wry>::new()
                    $($(.constant($const_name, $const_value))*)?
                    .commands(tauri_specta::collect_commands![$($module::$command),*])
                    .export(
                        specta_typescript::Typescript::default(),
                        concat!("../src/lib/generated/", $service, ".ts"),
                    )
                    .expect(concat!("failed to export ", $service, " bindings"));
            )*
        }
    };
}

services! {
    "settings" {
        commands: [
            settings::get_arch,
            settings::get_settings,
            settings::update_settings,
        ],
    },
    "project" {
        commands: [
            db::list_projects,
            db::get_project_by_id,
            db::create_project,
            db::rename_project,
            db::delete_project,
            db::reset_all_data,
        ],
    },
    "profile" {
        commands: [
            db::list_profiles,
            db::get_profile_by_id,
            db::create_profile,
            db::update_profile,
            db::delete_profile,
        ],
    },
    "error" {
        consts: ["MAX_ERRORS" => errors::MAX_ERRORS],
        commands: [
            errors::register_error,
            errors::get_errors,
            errors::clear_errors,
            errors::remove_error,
        ],
    },
    "collection" {
        consts: ["MAX_FRAMES" => collection::MAX_FRAMES],
        commands: [
            collection::start_collection,
            collection::stop_collection,
            collection::get_collection_snapshot,
        ],
    },
    "archive" {
        commands: [
            archive::save_collection,
            archive::list_collections,
            archive::delete_collection,
            archive::update_collection,
            archive::load_collection,
            archive::disk_usage,
        ],
    },
    "agent" {
        commands: [rpc::agent_ping],
    },
    "update" {
        commands: [
            update::check_update,
            update::install_update,
        ],
    },
    "opener" {
        commands: [opener::open],
    },
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        // WebKitGTK only enables accelerated compositing when it decides the page
        // needs it, and otherwise rasterizes on the CPU through Cairo. The dashboards
        // repaint two dozen up to 500-vertex chart paths once per sample, which is
        // slow enough to stall page switches on Linux.
        const VAR: &str = "WEBKIT_FORCE_COMPOSITING_MODE";
        if std::env::var_os(VAR).is_none() {
            unsafe { std::env::set_var(VAR, "1") };
        }
    }

    let builder = make_builder();

    #[cfg(debug_assertions)]
    export_service_bindings();

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

            Ok(())
        })
        .manage(AppState::default())
        .invoke_handler(builder.invoke_handler())
        .build(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("error while building tauri application: {e}");
            std::process::exit(1);
        })
        .run(|_app_handle, _event| {});
}
