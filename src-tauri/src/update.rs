// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

const RELEASES_LATEST_API: &str = "https://api.github.com/repos/TB004/pprof-viz/releases/latest";
const ASSETS_API: &str = "https://api.github.com/repos/TB004/pprof-viz/releases/assets";

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub current_version: String,
    pub latest_version: String,
    pub available: bool,
    pub release_url: String,
    /// `https://api.github.com/repos/.../releases/assets/{id}`.
    /// `None` when no update is available or no matching asset was found.
    pub asset_url: Option<String>,
    /// Original asset filename (e.g. `Pprof-Viz_0.1.2_aarch64.dmg`).
    /// Needed so the downloaded file gets the right name and extension.
    pub asset_filename: Option<String>,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
struct GitHubAsset {
    id: u64,
    name: String,
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(concat!("pprof-viz-updater/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn check_update(app: AppHandle) -> Result<UpdateStatus, String> {
    let current_version = app.package_info().version.to_string();

    let resp = http_client()?
        .get(RELEASES_LATEST_API)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status() == 404 {
        return Err("No stable release has been published yet.".into());
    }
    if !resp.status().is_success() {
        return Err(format!("GitHub API returned status {}", resp.status()));
    }

    let release: GitHubRelease = resp.json().await.map_err(|e| e.to_string())?;

    // Check if an update is available based on version diff
    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    let strip = |s: &str| semver::Version::parse(s.trim_start_matches('v')).ok();
    let available = matches!((strip(&latest_version), strip(&current_version)), (Some(c), Some(cur)) if c > cur);

    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    // Returns `(api_url, filename)` for the asset matching the running OS/arch.
    let assets = release
        .assets
        .iter()
        .find(|a| {
            let n = &a.name;
            match (os, arch) {
                ("macos", "aarch64") => n.ends_with(".dmg"),
                ("windows", "x86_64") => n.contains("x64") && n.ends_with(".msi"),
                ("windows", "aarch64") => n.contains("arm64") && n.ends_with(".msi"),
                ("linux", "x86_64") => n.contains("x86_64") && n.ends_with(".flatpak"),
                ("linux", "aarch64") => n.contains("aarch64") && n.ends_with(".flatpak"),
                _ => false,
            }
        })
        .map(|a| (format!("{}/{}", ASSETS_API, a.id), a.name.clone()));

    let (asset_url, asset_filename) = match (available, assets) {
        (true, Some((url, name))) => (Some(url), Some(name)),
        _ => (None, None),
    };

    let release_url = format!(
        "https://github.com/TB004/pprof-viz/releases/tag/{}",
        release.tag_name
    );

    Ok(UpdateStatus {
        current_version,
        latest_version,
        available,
        release_url,
        asset_url,
        asset_filename,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn install_update(app: AppHandle, url: String, filename: String) -> Result<(), String> {
    // GitHub responds with a redirect to the actual CDN URL; reqwest follows it.
    let bytes = http_client()?
        .get(&url)
        .header(reqwest::header::ACCEPT, "application/octet-stream")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let dest = std::env::temp_dir().join(&filename);
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    // Open with the OS default handler.
    crate::opener::open(dest.to_str().ok_or("non-UTF-8 temp path")?.to_owned())?;

    // Exit so the installer can overwrite the running binary.
    app.exit(0);
    Ok(())
}
