// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

use std::sync::Arc;

use crate::collection::CollectionStore;
use crate::errors::ErrorLog;

#[derive(Debug, Default)]
pub struct AppState {
    pub errors: Arc<ErrorLog>,
    pub collection: Arc<CollectionStore>,
}
