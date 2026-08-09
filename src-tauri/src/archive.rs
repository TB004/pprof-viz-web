// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

use std::collections::VecDeque;
use std::path::PathBuf;

use buffa::Message;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::watch;

use crate::collection::{self, CollectionSession, CollectionStatus, Frame};
use crate::proto::proto::{AllResponse, CollectionMeta, MetadataResponse, StoredCollection};
use crate::settings::CollectionType;
use crate::state::AppState;
use crate::utils;

/// Current on-disk `.ppvz` format version. Bump when the layout changes in a
/// way that needs a migration on read.
const FORMAT_VERSION: u32 = 1;

/// Emitted after a collection is loaded via a double-clicked file, so the
/// frontend can navigate to a metric page (warm-start only — cold start relies
/// on snapshot hydration).
pub const EVENT_OPENED: &str = "archive://opened";

/// zstd compression level for `.ppvz` payloads. The delta-encoded protobuf is
/// already compact; zstd squeezes the repeated count arrays further. Saving is
/// an infrequent, deliberate action so a high level is fine.
const ZSTD_LEVEL: i32 = 19;

/// Magic bytes at the start of every zstd frame (0xFD2FB528, little-endian).
const ZSTD_MAGIC: [u8; 4] = [0x28, 0xB5, 0x2F, 0xFD];

/// Decode a `.ppvz` file, transparently decompressing zstd-wrapped payloads
fn read_stored(path: &std::path::Path) -> Result<StoredCollection, String> {
    let raw = std::fs::read(path).map_err(|e| e.to_string())?;
    let bytes = if raw.starts_with(&ZSTD_MAGIC) {
        zstd::decode_all(&raw[..]).map_err(|e| format!("zstd decompress: {e}"))?
    } else {
        raw
    };
    StoredCollection::decode_from_slice(&bytes).map_err(|e| format!("decode .ppvz: {e}"))
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CollectionRow {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub filename: String,
    #[specta(type = utils::TsNumber)]
    pub size_bytes: i64,
    #[specta(type = utils::TsNumber)]
    pub duration_ms: i64,
    #[specta(type = utils::TsNumber)]
    pub sample_count: i64,
    pub profile_name: Option<String>,
    pub profile_url: Option<String>,
    pub mode: Option<String>,
    #[specta(type = utils::TsNumber)]
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DiskUsage {
    /// Total bytes of all stored `.ppvz` files (from the metadata table).
    #[specta(type = utils::TsNumber)]
    pub collections_bytes: i64,
    /// Free space on the volume that holds the collections folder.
    #[specta(type = utils::TsNumber)]
    pub free_bytes: u64,
    /// Total size of that volume.
    #[specta(type = utils::TsNumber)]
    pub total_bytes: u64,
}

// ---------- helpers ----------

/// Path to `<app_data_dir>/collections`, created on demand.
fn collections_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("collections");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn mode_from_str(s: Option<&str>) -> CollectionType {
    match s {
        Some("snapshot") => CollectionType::Snapshot,
        _ => CollectionType::Stream,
    }
}

/// Drop histogram `buckets` arrays (kept once in metadata) while preserving the
/// rest of a value. Used on the first frame, which stays dense.
fn strip_buckets(v: &Value) -> Value {
    match v {
        Value::Object(m) if collection::is_histogram(v) => {
            let mut out = Map::new();
            if let Some(c) = m.get("counts") {
                out.insert("counts".into(), c.clone());
            }
            if let Some(u) = m.get("updatedCounts") {
                out.insert("updatedCounts".into(), u.clone());
            }
            Value::Object(out)
        }
        Value::Object(m) => Value::Object(
            m.iter()
                .map(|(k, val)| (k.clone(), strip_buckets(val)))
                .collect(),
        ),
        other => other.clone(),
    }
}

/// Reduce a dense merged histogram to a sparse `updatedCounts` delta against the
/// previous frame's dense counts. Returns `None` when nothing changed (the
/// merge replay carries the previous distribution forward).
fn histogram_delta(prev: Option<&Value>, next: &Value) -> Option<Value> {
    let Some(next_counts) = next.get("counts").and_then(Value::as_array) else {
        // No dense counts to diff — fall back to emitting the value verbatim.
        return Some(strip_buckets(next));
    };
    let prev_counts = prev.and_then(|p| p.get("counts")).and_then(Value::as_array);
    let mut updated = Map::new();
    for (i, nv) in next_counts.iter().enumerate() {
        let changed = match prev_counts.and_then(|p| p.get(i)) {
            Some(pv) => pv != nv,
            None => !match nv {
                Value::String(s) => s == "0",
                Value::Number(n) => n.as_f64() == Some(0.0),
                _ => false,
            },
        };
        if changed {
            updated.insert(i.to_string(), nv.clone());
        }
    }
    if updated.is_empty() {
        return None;
    }
    let mut out = Map::new();
    out.insert("updatedCounts".into(), Value::Object(updated));
    Some(Value::Object(out))
}

/// Build a sparse "wire-style" frame from two consecutive merged frames:
/// histograms become `updatedCounts` deltas, scalars are emitted only when they
/// change, and unchanged groups are omitted entirely. `prev` is `Value::Null`
/// for the first frame, which is kept dense (minus bucket arrays).
fn diff_frame(prev: &Value, next: &Value) -> Value {
    let Value::Object(next_obj) = next else {
        return next.clone();
    };
    let Some(prev_obj) = prev.as_object() else {
        // First frame: keep everything dense, just drop bucket arrays.
        return Value::Object(
            next_obj
                .iter()
                .map(|(k, v)| (k.clone(), strip_buckets(v)))
                .collect(),
        );
    };

    let mut out = Map::new();
    for (group, next_group) in next_obj {
        let prev_group = prev_obj.get(group);
        let Value::Object(ng) = next_group else {
            if prev_group != Some(next_group) {
                out.insert(group.clone(), next_group.clone());
            }
            continue;
        };
        let pg = prev_group.and_then(Value::as_object);
        let mut group_out = Map::new();
        for (field, nv) in ng {
            let pv = pg.and_then(|m| m.get(field));
            if collection::is_histogram(nv) {
                if let Some(delta) = histogram_delta(pv, nv) {
                    group_out.insert(field.clone(), delta);
                }
            } else if pv != Some(nv) {
                group_out.insert(field.clone(), nv.clone());
            }
        }
        if !group_out.is_empty() {
            out.insert(group.clone(), Value::Object(group_out));
        }
    }
    Value::Object(out)
}

/// Serialize the in-memory merged frames into a delta-encoded `StoredCollection`.
fn encode_stored(
    frames: &[Frame],
    frame_timestamps: Vec<i64>,
    metadata: Option<Value>,
    meta: CollectionMeta,
) -> Result<StoredCollection, String> {
    let mut proto_frames: Vec<AllResponse> = Vec::with_capacity(frames.len());
    let mut prev = Value::Null;
    for frame in frames {
        let sparse = diff_frame(&prev, &frame.0);
        let af: AllResponse =
            serde_json::from_value(sparse).map_err(|e| format!("encode frame: {e}"))?;
        proto_frames.push(af);
        prev = frame.0.clone();
    }

    let metadata = match metadata {
        Some(v) => buffa::MessageField::some(
            serde_json::from_value::<MetadataResponse>(v)
                .map_err(|e| format!("encode metadata: {e}"))?,
        ),
        None => buffa::MessageField::default(),
    };

    Ok(StoredCollection {
        format_version: FORMAT_VERSION,
        metadata,
        frames: proto_frames,
        frame_timestamps,
        meta: buffa::MessageField::some(meta),
        ..Default::default()
    })
}

/// A decoded collection, ready to install into the store.
struct DecodedCollection {
    frames: VecDeque<Frame>,
    frame_times: VecDeque<i64>,
    metadata: Option<Value>,
    meta: CollectionMeta,
}

/// Replay a decoded `StoredCollection` back into dense merged frames.
fn decode_stored(stored: StoredCollection) -> Result<DecodedCollection, String> {
    let metadata = match stored.metadata.as_option() {
        Some(m) => Some(serde_json::to_value(m).map_err(|e| e.to_string())?),
        None => None,
    };

    let mut frames: VecDeque<Frame> = VecDeque::with_capacity(stored.frames.len());
    let mut prev = Value::Null;
    for af in &stored.frames {
        let v = serde_json::to_value(af).map_err(|e| e.to_string())?;
        let merged = collection::merge_frame(prev, v);
        frames.push_back(Frame(merged.clone()));
        prev = merged;
    }

    let frame_times: VecDeque<i64> = stored.frame_timestamps.into_iter().collect();
    let meta = stored.meta.into_option().unwrap_or_default();
    Ok(DecodedCollection {
        frames,
        frame_times,
        metadata,
        meta,
    })
}

/// Build an Idle, loaded `CollectionSession` from decoded frames and install it
/// into the store.
fn install_loaded(
    app: &AppHandle,
    decoded: DecodedCollection,
    profile_name: String,
    profile_url: String,
    mode: CollectionType,
    started_at: i64,
    duration_ms: i64,
) {
    let (cancel_tx, _cancel_rx) = watch::channel(false);
    let session = CollectionSession {
        session_id: ulid::Ulid::generate().to_string(),
        status: CollectionStatus::Idle,
        // Empty profile id so the frontend treats the source as unselected
        // (the originating profile may no longer exist).
        profile_id: String::new(),
        profile_name,
        profile_url,
        mode,
        started_at,
        ended_at: Some(started_at + duration_ms),
        loaded: true,
        saved: false,
        frames: decoded.frames,
        frame_times: decoded.frame_times,
        metadata: decoded.metadata,
        cancel_tx,
    };

    let store = app.state::<AppState>().collection.clone();
    if let Some(prev_cancel) = store.replace(session) {
        let _ = prev_cancel.send(true);
    }
    collection::emit_state(app, Some(store.snapshot()));
}

// ---------- commands ----------

#[tauri::command]
#[specta::specta]
pub async fn save_collection(
    app: AppHandle,
    name: String,
    description: Option<String>,
) -> Result<CollectionRow, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("collection name must not be empty".into());
    }

    let snapshot = app.state::<AppState>().collection.snapshot();
    if snapshot.frames.is_empty() {
        return Err("no collected data to save".into());
    }
    let started_at = snapshot
        .started_at
        .ok_or_else(|| "collection has no start time".to_string())?;
    let duration_ms = (snapshot.ended_at.unwrap_or_else(utils::now_millis) - started_at).max(0);
    let sample_count = snapshot.frames.len() as i64;
    let created_at = utils::now_millis();

    let description = description.and_then(|d| {
        let d = d.trim().to_string();
        if d.is_empty() { None } else { Some(d) }
    });
    let mode_str = snapshot.mode.map(|m| {
        match m {
            CollectionType::Snapshot => "snapshot",
            CollectionType::Stream => "stream",
        }
        .to_string()
    });

    // Self-describing metadata embedded in the file for portability.
    let meta = CollectionMeta {
        name: name.clone(),
        description: description.clone().unwrap_or_default(),
        profile_name: snapshot.profile_name.clone().unwrap_or_default(),
        profile_url: snapshot.profile_url.clone().unwrap_or_default(),
        mode: mode_str.clone().unwrap_or_default(),
        created_at,
        duration_ms,
        sample_count: sample_count as u32,
        ..Default::default()
    };

    let stored = encode_stored(
        &snapshot.frames,
        snapshot.frame_timestamps.clone(),
        snapshot.metadata.clone(),
        meta,
    )?;
    let proto = stored.encode_to_vec();
    let bytes =
        zstd::encode_all(&proto[..], ZSTD_LEVEL).map_err(|e| format!("zstd compress: {e}"))?;

    let id = ulid::Ulid::generate().to_string();
    let filename = format!("{id}.ppvz");
    let path = collections_dir(&app)?.join(&filename);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    let row = CollectionRow {
        id,
        name,
        description,
        filename,
        size_bytes: bytes.len() as i64,
        duration_ms,
        sample_count,
        profile_name: snapshot.profile_name.clone(),
        profile_url: snapshot.profile_url.clone(),
        mode: mode_str,
        created_at,
    };

    let pool = app.state::<SqlitePool>().inner().clone();
    sqlx::query(
        "INSERT INTO collections (id, name, description, filename, size_bytes, duration_ms, \
         sample_count, profile_name, profile_url, mode, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&row.id)
    .bind(&row.name)
    .bind(row.description.as_deref())
    .bind(&row.filename)
    .bind(row.size_bytes)
    .bind(row.duration_ms)
    .bind(row.sample_count)
    .bind(row.profile_name.as_deref())
    .bind(row.profile_url.as_deref())
    .bind(row.mode.as_deref())
    .bind(row.created_at)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    // This exact session is now archived — disable further saves of it.
    let store = app.state::<AppState>().collection.clone();
    store.mark_saved();
    collection::emit_state(&app, Some(store.snapshot()));

    Ok(row)
}

#[tauri::command]
#[specta::specta]
pub async fn list_collections(app: AppHandle) -> Result<Vec<CollectionRow>, String> {
    let pool = app.state::<SqlitePool>().inner().clone();
    sqlx::query_as::<_, CollectionRow>("SELECT * FROM collections ORDER BY created_at DESC")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_collection(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>().inner().clone();
    let filename: Option<(String,)> =
        sqlx::query_as("SELECT filename FROM collections WHERE id = ?")
            .bind(&id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM collections WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some((filename,)) = filename {
        let _ = std::fs::remove_file(collections_dir(&app)?.join(filename));
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn update_collection(
    app: AppHandle,
    id: String,
    name: String,
    description: Option<String>,
) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("collection name must not be empty".into());
    }
    let description = description.and_then(|d| {
        let d = d.trim().to_string();
        if d.is_empty() { None } else { Some(d) }
    });

    let pool = app.state::<SqlitePool>().inner().clone();
    sqlx::query("UPDATE collections SET name = ?, description = ? WHERE id = ?")
        .bind(&name)
        .bind(description.as_deref())
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn load_collection(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>().inner().clone();
    let row = sqlx::query_as::<_, CollectionRow>("SELECT * FROM collections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("collection '{id}' not found"))?;

    let path = collections_dir(&app)?.join(&row.filename);
    let decoded = decode_stored(read_stored(&path)?)?;

    // Database row is authoritative for an archived collection (reflects edits).
    install_loaded(
        &app,
        decoded,
        row.profile_name.clone().unwrap_or_default(),
        row.profile_url.clone().unwrap_or_default(),
        mode_from_str(row.mode.as_deref()),
        row.created_at,
        row.duration_ms,
    );
    Ok(())
}

/// Load a `.ppvz` directly from a filesystem path (e.g. a double-clicked file).
/// If the file is one of ours (matching filename in the archive), the database
/// row wins; otherwise the embedded metadata is used. Loads ephemerally — an
/// external file is not imported into the archive.
pub async fn load_from_path(app: &AppHandle, path: &std::path::Path) -> Result<(), String> {
    let decoded = decode_stored(read_stored(path)?)?;

    let pool = app.state::<SqlitePool>().inner().clone();

    // Prefer the archive row if this file lives in our collections folder.
    let db_row = match path.file_name().and_then(|n| n.to_str()) {
        Some(filename) => {
            sqlx::query_as::<_, CollectionRow>("SELECT * FROM collections WHERE filename = ?")
                .bind(filename)
                .fetch_optional(&pool)
                .await
                .map_err(|e| e.to_string())?
        }
        None => None,
    };

    let (profile_name, profile_url, mode, started_at, duration_ms) = match db_row {
        Some(row) => (
            row.profile_name.unwrap_or_default(),
            row.profile_url.unwrap_or_default(),
            mode_from_str(row.mode.as_deref()),
            row.created_at,
            row.duration_ms,
        ),
        None => {
            let m = &decoded.meta;
            (
                m.profile_name.clone(),
                m.profile_url.clone(),
                mode_from_str(Some(m.mode.as_str())),
                if m.created_at != 0 {
                    m.created_at
                } else {
                    utils::now_millis()
                },
                m.duration_ms,
            )
        }
    };

    install_loaded(
        app,
        decoded,
        profile_name,
        profile_url,
        mode,
        started_at,
        duration_ms,
    );
    app.emit(EVENT_OPENED, ()).ok();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn disk_usage(app: AppHandle) -> Result<DiskUsage, String> {
    let dir = collections_dir(&app)?;
    let pool = app.state::<SqlitePool>().inner().clone();
    let collections_bytes: i64 =
        sqlx::query_scalar("SELECT COALESCE(SUM(size_bytes), 0) FROM collections")
            .fetch_one(&pool)
            .await
            .map_err(|e| e.to_string())?;
    let free_bytes = fs4::free_space(&dir).map_err(|e| e.to_string())?;
    let total_bytes = fs4::total_space(&dir).map_err(|e| e.to_string())?;
    Ok(DiskUsage {
        collections_bytes,
        free_bytes,
        total_bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Histogram counts may be JSON numbers or proto3 strings; compare by value.
    fn counts_u64(frame: &Value, group: &str, hist: &str) -> Vec<u64> {
        frame[group][hist]["counts"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| {
                v.as_u64()
                    .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                    .unwrap()
            })
            .collect()
    }

    // Full save→encode→decode→load round-trip over the same delta shapes that
    // arrive on the wire. Validates the buffa JSON↔proto bridge end to end.
    #[test]
    fn delta_roundtrip_reconstructs_merged_frames() {
        // Build merged frames exactly as streaming would.
        let f0 = collection::merge_frame(
            Value::Null,
            json!({
                "scheduler": {
                    "latenciesSeconds": { "updatedCounts": { "1": "3", "3": "5" } },
                    "liveGoroutines": 10
                }
            }),
        );
        let f1 = collection::merge_frame(
            f0.clone(),
            json!({
                "scheduler": {
                    "latenciesSeconds": { "updatedCounts": { "3": "9", "4": "2" } },
                    "liveGoroutines": 25
                }
            }),
        );
        let original = vec![Frame(f0.clone()), Frame(f1.clone())];
        let metadata = Some(json!({
            "scheduler": { "latenciesSecondsBuckets": [0.1, 0.2, 0.3, 0.4, 0.5] }
        }));

        let meta = CollectionMeta {
            name: "test".into(),
            sample_count: 2,
            duration_ms: 2000,
            ..Default::default()
        };
        let stored =
            encode_stored(&original, vec![100, 200], metadata.clone(), meta).expect("encode");
        let bytes = stored.encode_to_vec();
        let decoded = StoredCollection::decode_from_slice(&bytes).expect("decode");
        let out = decode_stored(decoded).expect("decode_stored");
        let frames = out.frames;

        assert_eq!(frames.len(), 2);
        // Histograms reconstruct to the same dense distributions.
        assert_eq!(
            counts_u64(&frames[0].0, "scheduler", "latenciesSeconds"),
            counts_u64(&f0, "scheduler", "latenciesSeconds")
        );
        assert_eq!(
            counts_u64(&frames[1].0, "scheduler", "latenciesSeconds"),
            counts_u64(&f1, "scheduler", "latenciesSeconds")
        );
        // Scalars carried forward / updated correctly.
        assert_eq!(
            frames[1].0["scheduler"]["liveGoroutines"].as_u64(),
            Some(25)
        );
        // Frame timestamps and embedded meta survive the round-trip.
        assert_eq!(out.frame_times, vec![100, 200]);
        assert_eq!(out.meta.name, "test");
        assert_eq!(out.meta.sample_count, 2);
        // Metadata buckets survive the round-trip.
        assert!(out.metadata.is_some());
        assert_eq!(
            out.metadata.unwrap()["scheduler"]["latenciesSecondsBuckets"]
                .as_array()
                .unwrap()
                .len(),
            5
        );
    }

    // `read_stored` must transparently handle both zstd-compressed files (the
    // current format) and legacy raw-protobuf files.
    #[test]
    fn reads_both_zstd_and_raw_ppvz() {
        let stored = StoredCollection {
            format_version: FORMAT_VERSION,
            frames: vec![AllResponse::default(), AllResponse::default()],
            ..Default::default()
        };
        let proto = stored.encode_to_vec();
        let dir = std::env::temp_dir();

        // Legacy raw protobuf.
        let raw_path = dir.join(format!("ppvz_raw_{}.ppvz", ulid::Ulid::generate()));
        std::fs::write(&raw_path, &proto).unwrap();
        assert_eq!(read_stored(&raw_path).unwrap().frames.len(), 2);
        std::fs::remove_file(&raw_path).ok();

        // zstd-compressed.
        let comp = zstd::encode_all(&proto[..], ZSTD_LEVEL).unwrap();
        assert!(comp.starts_with(&ZSTD_MAGIC));
        let z_path = dir.join(format!("ppvz_z_{}.ppvz", ulid::Ulid::generate()));
        std::fs::write(&z_path, &comp).unwrap();
        assert_eq!(read_stored(&z_path).unwrap().frames.len(), 2);
        std::fs::remove_file(&z_path).ok();
    }
}
