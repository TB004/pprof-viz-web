use std::collections::VecDeque;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::watch;

use crate::db::{self, ProfileDescriptor};
use crate::errors;
use crate::rpc::AgentClient;
use crate::settings::CollectionType;
use crate::state::AppState;
use crate::utils;

pub const MAX_FRAMES: usize = 500;

pub const EVENT_FRAME: &str = "collection://frame";
pub const EVENT_STATE: &str = "collection://state";
pub const EVENT_METADATA: &str = "collection://metadata";

const SUB_KEYS: &[&str] = &["scheduler", "goDebug", "gc", "memory", "cpu", "cgo", "sync"];

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum CollectionStatus {
    Idle,
    Running,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, specta::Type)]
#[serde(transparent)]
pub struct Frame(#[specta(type = specta_typescript::Unknown)] pub Value);

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CollectionStateSnapshot {
    pub status: CollectionStatus,
    pub profile_id: Option<String>,
    pub profile_name: Option<String>,
    pub profile_url: Option<String>,
    pub mode: Option<CollectionType>,
    #[specta(type = Option<f64>)]
    pub started_at: Option<i64>,
    #[specta(type = f64)]
    pub sample_count: usize,
    pub frames: Vec<Frame>,
    #[specta(type = Option<specta_typescript::Unknown>)]
    pub metadata: Option<Value>,
}

#[derive(Debug)]
pub struct CollectionSession {
    pub session_id: String,
    pub status: CollectionStatus,
    pub profile_id: String,
    pub profile_name: String,
    pub profile_url: String,
    pub mode: CollectionType,
    pub started_at: i64,
    pub frames: VecDeque<Frame>,
    pub metadata: Option<Value>,
    pub cancel_tx: watch::Sender<bool>,
}

#[derive(Debug, Default)]
pub struct CollectionStore {
    inner: Mutex<Option<CollectionSession>>,
}

impl CollectionStore {
    pub fn snapshot(&self) -> CollectionStateSnapshot {
        let guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        match guard.as_ref() {
            Some(session) => CollectionStateSnapshot {
                status: session.status,
                profile_id: Some(session.profile_id.clone()),
                profile_name: Some(session.profile_name.clone()),
                profile_url: Some(session.profile_url.clone()),
                mode: Some(session.mode),
                started_at: Some(session.started_at),
                sample_count: session.frames.len(),
                frames: session.frames.iter().cloned().collect(),
                metadata: session.metadata.clone(),
            },
            None => CollectionStateSnapshot {
                status: CollectionStatus::Idle,
                profile_id: None,
                profile_name: None,
                profile_url: None,
                mode: None,
                started_at: None,
                sample_count: 0,
                frames: Vec::new(),
                metadata: None,
            },
        }
    }

    /// Replace the session entirely (clearing any previous frames). Returns
    /// the previous session's cancel sender so the caller can stop the
    /// outgoing worker before the new one starts.
    fn replace(&self, session: CollectionSession) -> Option<watch::Sender<bool>> {
        let mut guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let prev = guard.take().map(|s| s.cancel_tx);
        *guard = Some(session);
        prev
    }

    fn current_cancel(&self) -> Option<watch::Sender<bool>> {
        let guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        guard.as_ref().map(|s| s.cancel_tx.clone())
    }

    /// Push a merged frame into the active session, but only if the session
    /// id still matches — guards against a stale worker writing into a
    /// freshly-started session. Returns the new sample count, or `None`
    /// when the worker should exit.
    fn push_frame(&self, session_id: &str, frame: Frame) -> Option<usize> {
        let mut guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let session = guard.as_mut()?;
        if session.session_id != session_id {
            return None;
        }
        session.frames.push_back(frame);
        while session.frames.len() > MAX_FRAMES {
            session.frames.pop_front();
        }
        Some(session.frames.len())
    }

    fn last_frame_value(&self, session_id: &str) -> Option<Value> {
        let guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let session = guard.as_ref()?;
        if session.session_id != session_id {
            return None;
        }
        session.frames.back().map(|f| f.0.clone())
    }

    fn set_metadata(&self, session_id: &str, value: Value) -> bool {
        let mut guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(session) = guard.as_mut()
            && session.session_id == session_id
        {
            session.metadata = Some(value);
            true
        } else {
            false
        }
    }

    /// Mark the matching session as idle without dropping its frames. If
    /// the session has already been replaced by a newer one, this is a
    /// no-op.
    fn mark_idle(&self, session_id: &str) {
        let mut guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(session) = guard.as_mut()
            && session.session_id == session_id
        {
            session.status = CollectionStatus::Idle;
        }
    }
}

// ---------- merge helpers (mirrors the TS mergeFrame) ----------

fn merge_sub(prev: Option<Value>, next: Option<Value>) -> Option<Value> {
    // No update for this group on this frame — carry the previous value forward.
    let Some(next) = next else {
        return prev;
    };
    let Value::Object(nm) = next else {
        return Some(next);
    };
    let mut pm = match prev {
        Some(Value::Object(m)) => m,
        _ => Map::new(),
    };
    for (k, v) in nm {
        if v.is_null() {
            continue;
        }
        if is_histogram(&v) {
            // Histograms stream as sparse deltas; fold them into a dense array
            // instead of replacing the carried-forward distribution.
            let prev_v = pm.remove(&k);
            pm.insert(k, merge_histogram(prev_v, v));
        } else {
            pm.insert(k, v);
        }
    }
    Some(Value::Object(pm))
}

/// True if a JSON value looks like a serialized `Histogram` (carries dense
/// `counts` and/or sparse `updatedCounts`).
fn is_histogram(v: &Value) -> bool {
    matches!(
        v,
        Value::Object(m) if m.contains_key("counts") || m.contains_key("updatedCounts")
    )
}

/// Fold a streamed histogram into a dense `counts` array.
///
/// Go runtime histograms are cumulative, so the agent streams only the buckets
/// whose count changed (`updatedCounts`: bucket index -> new absolute count)
/// rather than the full `counts` array on every frame. Accumulate each frame's
/// dense snapshot and/or sparse update (latest value wins per bucket) so the
/// merged frame always carries the complete distribution — independent of the
/// rolling frame window.
fn merge_histogram(prev: Option<Value>, next: Value) -> Value {
    use std::collections::BTreeMap;

    let mut counts: BTreeMap<usize, Value> = BTreeMap::new();
    let mut buckets: Option<Value> = None;

    for src in [prev, Some(next)].into_iter().flatten() {
        let Value::Object(m) = src else {
            continue;
        };
        if let Some(Value::Array(dense)) = m.get("counts") {
            for (i, c) in dense.iter().enumerate() {
                counts.insert(i, c.clone());
            }
        }
        if let Some(Value::Object(updated)) = m.get("updatedCounts") {
            for (k, v) in updated {
                if let Ok(idx) = k.parse::<usize>() {
                    counts.insert(idx, v.clone());
                }
            }
        }
        match m.get("buckets") {
            Some(b) if !b.is_null() => buckets = Some(b.clone()),
            _ => {}
        }
    }

    let len = counts.keys().next_back().map_or(0, |&i| i + 1);
    let mut dense = vec![Value::from(0u64); len];
    for (idx, v) in counts {
        dense[idx] = v;
    }

    let mut out = Map::new();
    out.insert("counts".to_string(), Value::Array(dense));
    if let Some(b) = buckets {
        out.insert("buckets".to_string(), b);
    }
    Value::Object(out)
}

fn merge_frame(prev: Value, next: Value) -> Value {
    let mut prev_obj = match prev {
        Value::Object(m) => m,
        _ => Map::new(),
    };
    let mut next_obj = match next {
        Value::Object(m) => m,
        _ => return Value::Object(prev_obj),
    };
    for &key in SUB_KEYS {
        let prev_field = prev_obj.remove(key);
        let next_field = next_obj.remove(key);
        if let Some(merged) = merge_sub(prev_field, next_field) {
            prev_obj.insert(key.to_string(), merged);
        }
    }
    // Preserve any remaining keys (forwards-compatible if proto adds new
    // top-level groups before we update SUB_KEYS).
    for (k, v) in next_obj {
        prev_obj.insert(k, v);
    }
    Value::Object(prev_obj)
}

// ---------- commands ----------

#[tauri::command]
#[specta::specta]
pub async fn get_collection_snapshot(app: AppHandle) -> Result<CollectionStateSnapshot, String> {
    Ok(app.state::<AppState>().collection.snapshot())
}

#[tauri::command]
#[specta::specta]
pub async fn stop_collection(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    if let Some(tx) = state.collection.current_cancel() {
        let _ = tx.send(true);
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn start_collection(app: AppHandle, profile_id: String) -> Result<(), String> {
    let profile = db::load_profile(&app, &profile_id).await?;
    let client = AgentClient::connect(&profile.url, profile.token.as_deref(), profile.http_version)
        .map_err(|e| e.to_string())?;

    let (cancel_tx, cancel_rx) = watch::channel(false);
    let session_id = ulid::Ulid::new().to_string();
    let session = CollectionSession {
        session_id: session_id.clone(),
        status: CollectionStatus::Running,
        profile_id: profile.id.clone(),
        profile_name: profile.name.clone(),
        profile_url: profile.url.clone(),
        mode: profile.mode,
        started_at: utils::now_millis(),
        frames: VecDeque::new(),
        metadata: None,
        cancel_tx,
    };

    // Replace returns the previous session's cancel sender so we can stop
    // its worker; the previous session's frames are dropped here, which is
    // intentional — a fresh start clears the dashboards.
    let state_arc = app.state::<AppState>().collection.clone();
    if let Some(prev_cancel) = state_arc.replace(session) {
        let _ = prev_cancel.send(true);
    }

    emit_state(&app, Some(state_arc.snapshot()));

    let app_for_task = app.clone();
    tokio::spawn(async move {
        run_session(app_for_task, client, profile, session_id, cancel_rx).await;
    });

    Ok(())
}

fn emit_state(app: &AppHandle, snapshot: Option<CollectionStateSnapshot>) {
    let payload = snapshot.unwrap_or_else(|| CollectionStateSnapshot {
        status: CollectionStatus::Idle,
        profile_id: None,
        profile_name: None,
        profile_url: None,
        mode: None,
        started_at: None,
        sample_count: 0,
        frames: Vec::new(),
        metadata: None,
    });
    let _ = app.emit(EVENT_STATE, &payload);
}

async fn run_session(
    app: AppHandle,
    client: AgentClient,
    profile: ProfileDescriptor,
    session_id: String,
    mut cancel_rx: watch::Receiver<bool>,
) {
    let store = app.state::<AppState>().collection.clone();

    // Metadata fetch — races against cancellation so a stop request during
    // the RPC call is honoured immediately.
    tokio::select! {
        biased;
        changed = cancel_rx.changed() => {
            if changed.is_err() || *cancel_rx.borrow() {
                finish(&app, &store, &session_id);
                return;
            }
        }
        result = client.get_metadata() => match result {
            Ok(meta) => match serde_json::to_value(&meta) {
                Ok(value) => {
                    if store.set_metadata(&session_id, value.clone()) {
                        let _ = app.emit(EVENT_METADATA, &value);
                    }
                }
                Err(e) => {
                    errors::report(&app, format!("failed to serialize metadata: {e}"));
                    finish(&app, &store, &session_id);
                    return;
                }
            },
            Err(e) => {
                errors::report(&app, format!("failed to fetch metadata: {e}"));
                finish(&app, &store, &session_id);
                return;
            }
        }
    }

    match profile.mode {
        CollectionType::Snapshot => {
            tokio::select! {
                biased;
                changed = cancel_rx.changed() => {
                    if changed.is_err() || *cancel_rx.borrow() {
                        finish(&app, &store, &session_id);
                        return;
                    }
                }
                result = client.snapshot_all() => match result {
                    Ok(resp) => {
                        if let Ok(value) = serde_json::to_value(&resp) {
                            // Normalise histograms to dense `counts` for a
                            // consistent shape across snapshot and stream modes.
                            let value = merge_frame(Value::Null, value);
                            if store.push_frame(&session_id, Frame(value.clone())).is_some() {
                                let _ = app.emit(EVENT_FRAME, &value);
                            }
                        }
                    }
                    Err(e) => errors::report(&app, format!("snapshot failed: {e}")),
                }
            }
        }
        CollectionType::Stream => {
            let interval = profile.interval_seconds.unwrap_or(1) as u32;
            let cycles = profile.number_of_cycles.unwrap_or(0) as u32;
            // Pin the future so both select! arms share the same RPC call.
            let stream_fut = client.stream_all(interval, cycles);
            tokio::pin!(stream_fut);
            let stream_result = tokio::select! {
                biased;
                changed = cancel_rx.changed() => {
                    if changed.is_err() || *cancel_rx.borrow() {
                        finish(&app, &store, &session_id);
                        return;
                    }
                    // cancel_rx changed to false — impossible in practice, fall through.
                    (&mut stream_fut).await
                }
                result = &mut stream_fut => result,
            };
            match stream_result {
                Ok(mut stream) => loop {
                    tokio::select! {
                        biased;
                        changed = cancel_rx.changed() => {
                            if changed.is_err() || *cancel_rx.borrow() {
                                break;
                            }
                        }
                        msg = stream.message() => match msg {
                            Ok(Some(view)) => {
                                let owned = view.to_owned_message();
                                let next = match serde_json::to_value(&owned) {
                                    Ok(v) => v,
                                    Err(e) => {
                                        errors::report(&app, format!("frame serialize failed: {e}"));
                                        continue;
                                    }
                                };
                                // Always merge — even the first frame — so its
                                // histograms are normalised to dense `counts`.
                                let prev = store
                                    .last_frame_value(&session_id)
                                    .unwrap_or(Value::Null);
                                let merged = merge_frame(prev, next);
                                if store.push_frame(&session_id, Frame(merged.clone())).is_none() {
                                    break;
                                }
                                let _ = app.emit(EVENT_FRAME, &merged);
                            }
                            Ok(None) => break,
                            Err(e) => {
                                use connectrpc::ErrorCode;
                                if !matches!(e.code, ErrorCode::Canceled | ErrorCode::DeadlineExceeded) {
                                    errors::report(&app, format!("stream error: {e}"));
                                }
                                break;
                            }
                        }
                    }
                },
                Err(e) => errors::report(&app, format!("stream open failed: {e}")),
            }
        }
    }

    finish(&app, &store, &session_id);
}

/// Stop the worker and emit the resulting Idle state, but **keep the
/// frames** so the user can still inspect the dashboards. The session id
/// guard makes this a no-op if the session has already been replaced by a
/// newer one (in which case there's nothing to mark idle).
fn finish(app: &AppHandle, store: &CollectionStore, session_id: &str) {
    store.mark_idle(session_id);
    emit_state(app, Some(store.snapshot()));
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn counts(frame: &Value, group: &str, hist: &str) -> Vec<u64> {
        frame[group][hist]["counts"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_u64().unwrap())
            .collect()
    }

    #[test]
    fn histogram_deltas_accumulate_into_dense_counts() {
        // First frame: sparse updates only (no dense `counts`).
        let f1 = json!({
            "scheduler": { "latenciesSeconds": { "updatedCounts": { "1": 3, "3": 5 } } }
        });
        let merged1 = merge_frame(Value::Null, f1);
        assert_eq!(
            counts(&merged1, "scheduler", "latenciesSeconds"),
            vec![0, 3, 0, 5]
        );

        // Second frame: bucket 3 changes, bucket 4 appears; bucket 1 untouched
        // and must be carried forward.
        let f2 = json!({
            "scheduler": { "latenciesSeconds": { "updatedCounts": { "3": 9, "4": 2 } } }
        });
        let merged2 = merge_frame(merged1, f2);
        assert_eq!(
            counts(&merged2, "scheduler", "latenciesSeconds"),
            vec![0, 3, 0, 9, 2]
        );
    }

    #[test]
    fn scalar_fields_still_replace() {
        let f1 = json!({ "scheduler": { "liveGoroutines": 10 } });
        let f2 = json!({ "scheduler": { "liveGoroutines": 25 } });
        let merged = merge_frame(merge_frame(Value::Null, f1), f2);
        assert_eq!(merged["scheduler"]["liveGoroutines"], json!(25));
    }
}
