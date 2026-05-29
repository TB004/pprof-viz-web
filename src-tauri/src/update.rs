use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

const RELEASES_LATEST_API: &str = "https://api.github.com/repos/TB004/pprof-viz/releases/latest";
const RELEASES_ALL_API: &str = "https://api.github.com/repos/TB004/pprof-viz/releases?per_page=1";
const RELEASES_PAGE: &str = "https://github.com/TB004/pprof-viz/releases/latest";
const ASSETS_API: &str = "https://api.github.com/repos/TB004/pprof-viz/releases/assets";

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub current_version: String,
    pub latest_version: String,
    pub available: bool,
    pub release_url: String,
    /// `https://api.github.com/repos/.../releases/assets/{id}` — works for
    /// both public and private repos when fetched with
    /// `Accept: application/octet-stream`. `None` when no update is available
    /// or no matching asset was found.
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

/// Adds `Authorization: Bearer <token>` if `GITHUB_TOKEN` is set in the
/// environment. Required only for private repos during development; the
/// production repo is public and needs no auth.
fn with_auth(req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    if let Ok(token) = std::env::var("GITHUB_TOKEN") {
        req.bearer_auth(token)
    } else {
        req
    }
}

/// Returns `true` when `candidate` is a strictly newer semver than `current`.
fn is_newer(candidate: &str, current: &str) -> bool {
    let strip = |s: &str| semver::Version::parse(s.trim_start_matches('v')).ok();
    matches!((strip(candidate), strip(current)), (Some(c), Some(cur)) if c > cur)
}

/// Returns `(api_url, filename)` for the asset matching the running OS/arch.
/// Download via the API URL with `Accept: application/octet-stream` — this
/// works for both public and private repos, unlike `browser_download_url`
/// which only works with a browser session.
fn pick_asset(assets: &[GitHubAsset]) -> Option<(String, String)> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    assets
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
        .map(|a| (format!("{}/{}", ASSETS_API, a.id), a.name.clone()))
}

#[tauri::command]
#[specta::specta]
pub async fn check_update(app: AppHandle) -> Result<UpdateStatus, String> {
    let current_version = app.package_info().version.to_string();

    let client = http_client()?;

    // `/releases/latest` excludes pre-releases; fall back to the list endpoint
    // so testing with pre-release tags still works.
    let release: GitHubRelease = {
        let resp = with_auth(client.get(RELEASES_LATEST_API))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if resp.status().is_success() {
            resp.json().await.map_err(|e| e.to_string())?
        } else if resp.status() == 404 {
            // No stable release — try the full list (includes pre-releases).
            let list_resp = with_auth(client.get(RELEASES_ALL_API))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !list_resp.status().is_success() {
                return Err(format!("GitHub API returned status {}", list_resp.status()));
            }

            let list: Vec<GitHubRelease> = list_resp.json().await.map_err(|e| e.to_string())?;

            list.into_iter()
                .next()
                .ok_or_else(|| "No releases have been published yet.".to_string())?
        } else {
            return Err(format!("GitHub API returned status {}", resp.status()));
        }
    };
    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    let available = is_newer(&latest_version, &current_version);

    let (asset_url, asset_filename) = match (available, pick_asset(&release.assets)) {
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
    // The API assets endpoint requires `Accept: application/octet-stream`.
    // GitHub responds with a redirect to the actual CDN URL; reqwest follows it.
    let bytes = with_auth(http_client()?.get(&url))
        .header(reqwest::header::ACCEPT, "application/octet-stream")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let dest = std::env::temp_dir().join(&filename);
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    // Open with the OS default handler (Finder for DMG, msiexec for MSI).
    app.opener()
        .open_path(dest.to_str().ok_or("non-UTF-8 temp path")?, None::<&str>)
        .map_err(|e| e.to_string())?;

    // Exit so the installer can overwrite the running binary.
    app.exit(0);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn open_releases_page(app: AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(RELEASES_PAGE, None::<&str>)
        .map_err(|e| e.to_string())
}
