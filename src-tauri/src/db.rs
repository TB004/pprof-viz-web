//! Project + Profile persistence (sqlite via `tauri-plugin-sql`).
//!
//! The plugin owns the connection pool; we borrow it from `DbInstances` to
//! issue queries from Rust. The frontend never talks to sqlite directly.

use serde::{Deserialize, Serialize};
use sqlx::{Row, sqlite::SqlitePool};
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool, Migration, MigrationKind};

use crate::settings::CollectionType;
use crate::utils;

pub const DB_URL: &str = "sqlite:pprof-viz.db";

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create projects and profiles",
        sql: r#"
            CREATE TABLE projects (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL
            );

            CREATE TABLE profiles (
                id                  TEXT PRIMARY KEY,
                project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name                TEXT NOT NULL,
                url                 TEXT NOT NULL,
                mode                TEXT NOT NULL CHECK (mode IN ('snapshot', 'stream')),
                token               TEXT,
                interval_seconds    INTEGER,
                number_of_cycles    INTEGER,
                created_at          INTEGER NOT NULL,
                updated_at          INTEGER NOT NULL
            );

            CREATE INDEX idx_profiles_project ON profiles(project_id);
        "#,
        kind: MigrationKind::Up,
    }]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileRow {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub url: String,
    pub mode: CollectionType,
    pub token: Option<String>,
    pub interval_seconds: Option<u32>,
    pub number_of_cycles: Option<u32>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Lightweight view of a profile used by the collection worker. Drops the
/// timestamps and project_id that the streaming code doesn't need, and
/// uses the in-memory `CollectionType` enum instead of the wire string.
#[derive(Debug, Clone)]
pub struct ProfileDescriptor {
    pub id: String,
    pub name: String,
    pub url: String,
    pub mode: CollectionType,
    pub token: Option<String>,
    pub interval_seconds: Option<u32>,
    pub number_of_cycles: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub name: String,
    pub url: String,
    pub mode: CollectionType,
    pub token: Option<String>,
    pub interval_seconds: Option<u32>,
    pub number_of_cycles: Option<u32>,
}

async fn with_pool<F, Fut, T>(app: &AppHandle, f: F) -> Result<T, String>
where
    F: FnOnce(SqlitePool) -> Fut,
    Fut: std::future::Future<Output = Result<T, String>>,
{
    let instances = app.state::<DbInstances>();
    let pool = {
        let map = instances.0.read().await;
        let db = map
            .get(DB_URL)
            .ok_or_else(|| format!("db '{DB_URL}' not loaded"))?;
        match db {
            DbPool::Sqlite(pool) => pool.clone(),
            #[allow(unreachable_patterns)]
            _ => return Err("db pool is not sqlite".into()),
        }
    };
    f(pool).await
}

#[tauri::command]
pub async fn list_projects(app: AppHandle) -> Result<Vec<ProjectRow>, String> {
    with_pool(&app, |pool| async move {
        let rows = sqlx::query(
            "SELECT id, name, created_at, updated_at FROM projects ORDER BY created_at ASC",
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(rows
            .into_iter()
            .map(|r| ProjectRow {
                id: r.get("id"),
                name: r.get("name"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            })
            .collect())
    })
    .await
}

#[tauri::command]
pub async fn list_profiles(app: AppHandle) -> Result<Vec<ProfileRow>, String> {
    with_pool(&app, |pool| async move {
        let rows = sqlx::query(
            "SELECT id, project_id, name, url, mode, token, interval_seconds, \
             number_of_cycles, created_at, updated_at FROM profiles ORDER BY created_at ASC",
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(rows
            .into_iter()
            .map(|r| ProfileRow {
                id: r.get("id"),
                project_id: r.get("project_id"),
                name: r.get("name"),
                url: r.get("url"),
                mode: CollectionType::parse(r.get::<String, _>("mode").as_str()),
                token: r.get("token"),
                interval_seconds: r
                    .get::<Option<i64>, _>("interval_seconds")
                    .map(|v| v as u32),
                number_of_cycles: r
                    .get::<Option<i64>, _>("number_of_cycles")
                    .map(|v| v as u32),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            })
            .collect())
    })
    .await
}

/// Load a single profile by id, returning a [`ProfileDescriptor`] suitable
/// for the collection worker. Not exposed as a Tauri command — internal
/// to the Rust side (the collection module calls it during start_collection).
pub async fn load_profile(app: &AppHandle, profile_id: &str) -> Result<ProfileDescriptor, String> {
    let id = profile_id.to_string();
    with_pool(app, |pool| async move {
        let row = sqlx::query(
            "SELECT id, name, url, mode, token, interval_seconds, number_of_cycles \
             FROM profiles WHERE id = ?",
        )
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("profile '{id}' not found"))?;

        Ok(ProfileDescriptor {
            id: row.get("id"),
            name: row.get("name"),
            url: row.get("url"),
            mode: CollectionType::parse(row.get::<String, _>("mode").as_str()),
            token: row.get("token"),
            interval_seconds: row
                .get::<Option<i64>, _>("interval_seconds")
                .map(|v| v as u32),
            number_of_cycles: row
                .get::<Option<i64>, _>("number_of_cycles")
                .map(|v| v as u32),
        })
    })
    .await
}

#[tauri::command]
pub async fn create_project(app: AppHandle, name: String) -> Result<ProjectRow, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("project name must not be empty".into());
    }
    let now = utils::now_millis();
    let row = ProjectRow {
        id: ulid::Ulid::new().to_string(),
        name: trimmed,
        created_at: now,
        updated_at: now,
    };

    with_pool(&app, |pool| async move {
        sqlx::query("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
            .bind(&row.id)
            .bind(&row.name)
            .bind(row.created_at)
            .bind(row.updated_at)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(row)
    })
    .await
}

#[tauri::command]
pub async fn rename_project(app: AppHandle, id: String, name: String) -> Result<(), String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("project name must not be empty".into());
    }

    with_pool(&app, |pool| async move {
        sqlx::query("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?")
            .bind(trimmed)
            .bind(utils::now_millis())
            .bind(id)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    with_pool(&app, |pool| async move {
        sqlx::query("DELETE FROM projects WHERE id = ?")
            .bind(id)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn create_profile(
    app: AppHandle,
    project_id: String,
    input: ProfileInput,
) -> Result<ProfileRow, String> {
    let trimmed_name = input.name.trim().to_string();
    let trimmed_url = input.url.trim().to_string();
    if trimmed_name.is_empty() || trimmed_url.is_empty() {
        return Err("profile name and url must not be empty".into());
    }
    if url::Url::parse(&trimmed_url).is_err() {
        return Err(format!("invalid url: {trimmed_url}"));
    }
    let token = input.token.and_then(|t| {
        let t = t.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    });
    let now = utils::now_millis();
    let row = ProfileRow {
        id: ulid::Ulid::new().to_string(),
        project_id,
        name: trimmed_name,
        url: trimmed_url,
        mode: input.mode,
        token,
        interval_seconds: input.interval_seconds,
        number_of_cycles: input.number_of_cycles,
        created_at: now,
        updated_at: now,
    };

    with_pool(&app, |pool| async move {
        sqlx::query(
            "INSERT INTO profiles (id, project_id, name, url, mode, token, \
                 interval_seconds, number_of_cycles, created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&row.id)
        .bind(&row.project_id)
        .bind(&row.name)
        .bind(&row.url)
        .bind(row.mode.to_string())
        .bind(row.token.as_deref())
        .bind(row.interval_seconds.map(|v| v as i64))
        .bind(row.number_of_cycles.map(|v| v as i64))
        .bind(row.created_at)
        .bind(row.updated_at)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(row)
    })
    .await
}

#[tauri::command]
pub async fn update_profile(app: AppHandle, id: String, input: ProfileInput) -> Result<(), String> {
    let trimmed_name = input.name.trim().to_string();
    let trimmed_url = input.url.trim().to_string();
    if trimmed_name.is_empty() || trimmed_url.is_empty() {
        return Err("profile name and url must not be empty".into());
    }
    if url::Url::parse(&trimmed_url).is_err() {
        return Err(format!("invalid url: {trimmed_url}"));
    }
    let token = input.token.and_then(|t| {
        let t = t.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    });
    let now = utils::now_millis();

    with_pool(&app, move |pool| async move {
        sqlx::query(
            "UPDATE profiles SET name = ?, url = ?, mode = ?, token = ?, \
             interval_seconds = ?, number_of_cycles = ?, updated_at = ? WHERE id = ?",
        )
        .bind(&trimmed_name)
        .bind(&trimmed_url)
        .bind(input.mode.to_string())
        .bind(token.as_deref())
        .bind(input.interval_seconds.map(|v| v as i64))
        .bind(input.number_of_cycles.map(|v| v as i64))
        .bind(now)
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn delete_profile(app: AppHandle, id: String) -> Result<(), String> {
    with_pool(&app, |pool| async move {
        sqlx::query("DELETE FROM profiles WHERE id = ?")
            .bind(id)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
}
