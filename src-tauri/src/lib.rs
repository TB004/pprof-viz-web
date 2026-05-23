mod collection;
mod db;
mod errors;
mod proto;
mod rpc;
mod settings;
mod state;
mod utils;

use crate::state::AppState;

fn make_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::new().commands(tauri_specta::collect_commands![
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

    let builder = make_builder();

    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/lib/bindings.ts",
        )
        .expect("failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(db::DB_URL, db::migrations())
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState::default())
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("error while running tauri application: {e}");
            std::process::exit(1);
        });
}
