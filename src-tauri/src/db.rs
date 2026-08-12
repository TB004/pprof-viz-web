// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

use crate::settings;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    #[specta(type = crate::TsNumber)]
    pub created_at: i64,
    #[specta(type = crate::TsNumber)]
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileRow {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub url: String,
    pub mode: settings::CollectionType,
    pub http_version: settings::HttpVersion,
    pub token: Option<String>,
    pub allow_insecure_tls: bool,
    pub interval_seconds: Option<i16>,
    pub number_of_cycles: Option<i16>,
    #[specta(type = crate::TsNumber)]
    pub created_at: i64,
    #[specta(type = crate::TsNumber)]
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub name: String,
    pub url: String,
    pub mode: settings::CollectionType,
    pub http_version: settings::HttpVersion,
    pub token: Option<String>,
    pub allow_insecure_tls: bool,
    pub interval_seconds: Option<i16>,
    pub number_of_cycles: Option<i16>,
}

impl ProfileInput {
    /// Trim the user-supplied fields, rejecting a blank name or url and a url
    /// that does not parse.
    fn normalized(mut self) -> Result<Self, String> {
        self.name = self.name.trim().to_string();
        self.url = self.url.trim().to_string();
        if self.name.is_empty() || self.url.is_empty() {
            return Err("profile name and url must not be empty".into());
        }
        if url::Url::parse(&self.url).is_err() {
            return Err(format!("invalid url: {}", self.url));
        }
        self.token = crate::non_empty(self.token);
        Ok(self)
    }
}

/// The shared SQLite pool. Cloning is cheap — the pool is an `Arc` internally —
/// and it detaches the borrow from `app`, so callers can hold it across awaits.
pub(crate) fn pool(app: &AppHandle) -> SqlitePool {
    app.state::<SqlitePool>().inner().clone()
}

#[tauri::command]
#[specta::specta]
pub async fn list_projects(app: AppHandle) -> Result<Vec<ProjectRow>, String> {
    sqlx::query_as!(
        ProjectRow,
        r#"SELECT id AS "id!", name, created_at, updated_at FROM projects ORDER BY created_at ASC"#
    )
    .fetch_all(&pool(&app))
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_profiles(app: AppHandle) -> Result<Vec<ProfileRow>, String> {
    sqlx::query_as!(
        ProfileRow,
        r#"SELECT
            id AS "id!",
            project_id,
            name,
            url,
            mode AS "mode: settings::CollectionType",
            http_version AS "http_version: settings::HttpVersion",
            token,
            allow_insecure_tls,
            interval_seconds AS "interval_seconds: i16",
            number_of_cycles AS "number_of_cycles: i16",
            created_at,
            updated_at
        FROM profiles ORDER BY created_at ASC"#
    )
    .fetch_all(&pool(&app))
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_project_by_id(app: AppHandle, id: String) -> Result<Option<ProjectRow>, String> {
    sqlx::query_as!(
        ProjectRow,
        r#"SELECT id AS "id!", name, created_at, updated_at FROM projects WHERE id = ?"#,
        id
    )
    .fetch_optional(&pool(&app))
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_profile_by_id(app: AppHandle, id: String) -> Result<Option<ProfileRow>, String> {
    sqlx::query_as!(
        ProfileRow,
        r#"SELECT
            id AS "id!",
            project_id,
            name,
            url,
            mode AS "mode: settings::CollectionType",
            http_version AS "http_version: settings::HttpVersion",
            token,
            allow_insecure_tls,
            interval_seconds AS "interval_seconds: i16",
            number_of_cycles AS "number_of_cycles: i16",
            created_at,
            updated_at
        FROM profiles WHERE id = ?"#,
        id
    )
    .fetch_optional(&pool(&app))
    .await
    .map_err(|e| e.to_string())
}

/// Load a single profile by id. Not exposed as a Tauri command — internal to
/// the Rust side (the collection module calls it during start_collection).
pub async fn load_profile(app: &AppHandle, profile_id: &str) -> Result<ProfileRow, String> {
    sqlx::query_as!(
        ProfileRow,
        r#"SELECT
            id AS "id!",
            project_id,
            name,
            url,
            mode AS "mode: settings::CollectionType",
            http_version AS "http_version: settings::HttpVersion",
            token,
            allow_insecure_tls,
            interval_seconds AS "interval_seconds: i16",
            number_of_cycles AS "number_of_cycles: i16",
            created_at,
            updated_at
        FROM profiles WHERE id = ?"#,
        profile_id
    )
    .fetch_optional(&pool(app))
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("profile '{profile_id}' not found"))
}

#[tauri::command]
#[specta::specta]
pub async fn create_project(app: AppHandle, name: String) -> Result<ProjectRow, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("project name must not be empty".into());
    }
    let now = crate::now_millis();
    let row = ProjectRow {
        id: ulid::Ulid::generate().to_string(),
        name: trimmed,
        created_at: now,
        updated_at: now,
    };

    sqlx::query!(
        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        row.id,
        row.name,
        row.created_at,
        row.updated_at
    )
    .execute(&pool(&app))
    .await
    .map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
#[specta::specta]
pub async fn rename_project(app: AppHandle, id: String, name: String) -> Result<(), String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("project name must not be empty".into());
    }
    let now = crate::now_millis();

    sqlx::query!(
        "UPDATE projects SET name = ?, updated_at = ? WHERE id = ?",
        trimmed,
        now,
        id
    )
    .execute(&pool(&app))
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    sqlx::query!("DELETE FROM projects WHERE id = ?", id)
        .execute(&pool(&app))
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn create_profile(
    app: AppHandle,
    project_id: String,
    input: ProfileInput,
) -> Result<ProfileRow, String> {
    let input = input.normalized()?;
    let now = crate::now_millis();
    let row = ProfileRow {
        id: ulid::Ulid::generate().to_string(),
        project_id,
        name: input.name,
        url: input.url,
        mode: input.mode,
        http_version: input.http_version,
        token: input.token,
        allow_insecure_tls: input.allow_insecure_tls,
        interval_seconds: input.interval_seconds,
        number_of_cycles: input.number_of_cycles,
        created_at: now,
        updated_at: now,
    };

    sqlx::query!(
        "INSERT INTO profiles (id, project_id, name, url, mode, http_version, token, \
             allow_insecure_tls, interval_seconds, number_of_cycles, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        row.id,
        row.project_id,
        row.name,
        row.url,
        row.mode,
        row.http_version,
        row.token,
        row.allow_insecure_tls,
        row.interval_seconds,
        row.number_of_cycles,
        row.created_at,
        row.updated_at
    )
    .execute(&pool(&app))
    .await
    .map_err(|e| e.to_string())?;

    Ok(row)
}

#[tauri::command]
#[specta::specta]
pub async fn update_profile(app: AppHandle, id: String, input: ProfileInput) -> Result<(), String> {
    let input = input.normalized()?;

    let now = crate::now_millis();

    sqlx::query!(
        "UPDATE profiles SET name = ?, url = ?, mode = ?, http_version = ?, token = ?, \
         allow_insecure_tls = ?, interval_seconds = ?, number_of_cycles = ?, \
         updated_at = ? WHERE id = ?",
        input.name,
        input.url,
        input.mode,
        input.http_version,
        input.token,
        input.allow_insecure_tls,
        input.interval_seconds,
        input.number_of_cycles,
        now,
        id
    )
    .execute(&pool(&app))
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_profile(app: AppHandle, id: String) -> Result<(), String> {
    sqlx::query!("DELETE FROM profiles WHERE id = ?", id)
        .execute(&pool(&app))
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn reset_all_data(app: AppHandle) -> Result<(), String> {
    let pool = pool(&app);

    // Clear all DB rows (profiles cascade from projects)
    sqlx::query!("DELETE FROM projects")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    // Delete all stored collections (.ppvz files + DB rows)
    let filenames: Vec<String> = sqlx::query_scalar!("SELECT filename FROM collections")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Ok(collections_dir) = app.path().app_data_dir().map(|d| d.join("collections")) {
        for filename in &filenames {
            let _ = std::fs::remove_file(collections_dir.join(filename));
        }
    }

    sqlx::query!("DELETE FROM collections")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    // Reset settings to defaults
    app.state::<settings::SettingsState>()
        .set(settings::AppSettings::default())
        .await?;

    Ok(())
}
