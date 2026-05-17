//! Process-wide application state, registered into Tauri's managed state map.

use std::sync::Arc;

use crate::collection::CollectionStore;
use crate::errors::ErrorLog;

#[derive(Debug, Default)]
pub struct AppState {
    pub errors: Arc<ErrorLog>,
    pub collection: Arc<CollectionStore>,
}
