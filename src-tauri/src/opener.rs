use std::process::Command;

/// Opens a URL or file path with the OS default handler.
#[tauri::command]
#[specta::specta]
pub fn open(target: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(target)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", target])
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    Err("unsupported platform".into())
}
