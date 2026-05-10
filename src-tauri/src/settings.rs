//! `AppSettings` persisted via `tauri-plugin-store`.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const SETTINGS_STORE: &str = "settings.json";
const SETTINGS_KEY: &str = "app";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type, specta::Type)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
pub enum CollectionType {
    Snapshot,
    Stream,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: ThemeMode,
    pub default_name: String,
    pub default_url: String,
    pub default_mode: CollectionType,
    pub default_interval_seconds: u32,
    pub default_number_of_cycles: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: ThemeMode::System,
            default_name: String::new(),
            default_url: String::new(),
            default_mode: CollectionType::Stream,
            default_interval_seconds: 1,
            default_number_of_cycles: 0,
        }
    }
}

fn load(app: &AppHandle) -> Result<AppSettings, String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    Ok(store
        .get(SETTINGS_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default())
}

#[tauri::command]
#[specta::specta]
pub async fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    load(&app)
}

#[tauri::command]
#[specta::specta]
pub async fn update_settings(app: AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    store.set(
        SETTINGS_KEY,
        serde_json::to_value(&settings).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(settings)
}
