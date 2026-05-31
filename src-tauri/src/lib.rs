mod collection;
mod db;
mod errors;
mod proto;
mod rpc;
mod settings;
mod state;
mod update;
mod utils;

use tauri::Manager;

use crate::state::AppState;

fn make_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::new().commands(tauri_specta::collect_commands![
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
        rpc::agent_ping,
        update::check_update,
        update::install_update,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Fixes drastic linux performance issues
    #[cfg(target_os = "linux")]
    unsafe {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        // Only if you see compositing issues on Wayland:
        // std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }

    // Load .env if present (dev convenience; silently ignored in production).
    dotenvy::dotenv().ok();

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
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("error while running tauri application: {e}");
            std::process::exit(1);
        });
}
