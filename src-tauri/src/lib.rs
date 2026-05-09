mod collection;
mod db;
mod errors;
mod proto;
mod rpc;
mod settings;
mod state;
mod utils;

use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(db::DB_URL, db::migrations())
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            settings::get_settings,
            settings::update_settings,
            db::list_projects,
            db::list_profiles,
            db::create_project,
            db::rename_project,
            db::delete_project,
            db::create_profile,
            db::update_profile,
            db::delete_profile,
            errors::register_error,
            errors::get_errors,
            errors::clear_errors,
            errors::remove_error,
            collection::start_collection,
            collection::stop_collection,
            collection::get_collection_snapshot,
            rpc::agent_ping,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
