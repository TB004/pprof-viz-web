use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tokio::sync::RwLock;

const SETTINGS_FILE: &str = "settings.json";

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

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, sqlx::Type, specta::Type)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
pub enum HttpVersion {
    #[default]
    Http2,
    Http3,
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
    pub default_http_version: HttpVersion,
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
            default_http_version: HttpVersion::Http2,
        }
    }
}

pub struct SettingsState {
    inner: RwLock<AppSettings>,
    path: PathBuf,
}

impl SettingsState {
    pub fn load(data_dir: &Path) -> Self {
        let path = data_dir.join(SETTINGS_FILE);
        let settings = std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Self {
            inner: RwLock::new(settings),
            path,
        }
    }

    pub async fn get(&self) -> AppSettings {
        self.inner.read().await.clone()
    }

    pub async fn set(&self, settings: AppSettings) -> Result<AppSettings, String> {
        let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
        std::fs::write(&self.path, json).map_err(|e| e.to_string())?;
        *self.inner.write().await = settings.clone();
        Ok(settings)
    }
}

#[tauri::command]
#[specta::specta]
pub fn get_arch() -> String {
    std::env::consts::ARCH.to_string()
}

#[tauri::command]
#[specta::specta]
pub async fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    Ok(app.state::<SettingsState>().get().await)
}

#[tauri::command]
#[specta::specta]
pub async fn update_settings(app: AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    app.state::<SettingsState>().set(settings).await
}
