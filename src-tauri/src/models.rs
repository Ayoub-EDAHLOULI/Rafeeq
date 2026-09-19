use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct ModelInfo {
    name: String,
    file_name: String,
    size_bytes: u64,
    quant: Option<String>,
}

const QUANT_PATTERNS: &[&str] = &[
    "Q2_K", "Q3_K_S", "Q3_K_M", "Q3_K_L", "Q4_0", "Q4_1", "Q4_K_S", "Q4_K_M", "Q5_0", "Q5_1",
    "Q5_K_S", "Q5_K_M", "Q6_K", "Q8_0", "F16", "F32",
];

fn detect_quant(file_stem: &str) -> Option<String> {
    let upper = file_stem.to_uppercase();
    QUANT_PATTERNS
        .iter()
        .find(|pattern| upper.contains(*pattern))
        .map(|pattern| pattern.to_string())
}

fn display_name(file_stem: &str, quant: &Option<String>) -> String {
    let name = match quant {
        Some(q) => file_stem
            .to_uppercase()
            .find(q)
            .map(|idx| &file_stem[..idx])
            .unwrap_or(file_stem)
            .trim_end_matches(['.', '-', '_'])
            .to_string(),
        None => file_stem.to_string(),
    };
    name.replace(['-', '_'], " ")
}

#[tauri::command]
pub fn models_dir(app: AppHandle) -> Result<String, String> {
    let dir = resolve_models_dir(&app)?;
    Ok(dir.to_string_lossy().to_string())
}

/// Opens the models directory in the OS's file manager. Uses the platform's
/// native "reveal in file manager" command directly rather than a plugin,
/// so this stays a purely local OS call with no added network-capable
/// surface (see offline_audit).
#[tauri::command]
pub fn open_models_dir(app: AppHandle) -> Result<(), String> {
    let dir = resolve_models_dir(&app)?;

    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer").arg(&dir).spawn();

    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(&dir).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(&dir).spawn();

    result.map(|_| ()).map_err(|e| e.to_string())
}

pub fn resolve_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    let dir = base.join("models");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// If the user's models folder is empty and this build bundles a starter
/// model as a resource (see tauri.bundled.conf.json), copies it in on
/// first run. A no-op in the regular lean build, which has no bundled
/// resources/models directory.
pub fn install_bundled_model_if_needed(app: &AppHandle) {
    let Ok(dir) = resolve_models_dir(app) else {
        return;
    };

    let has_model = fs::read_dir(&dir)
        .map(|entries| {
            entries.flatten().any(|entry| {
                entry.path().extension().and_then(|e| e.to_str()) == Some("gguf")
            })
        })
        .unwrap_or(false);
    if has_model {
        return;
    }

    let Ok(resource_dir) = app.path().resource_dir() else {
        return;
    };
    let bundled_models_dir = resource_dir.join("models");
    let Ok(entries) = fs::read_dir(&bundled_models_dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("gguf") {
            continue;
        }
        if let Some(file_name) = path.file_name() {
            let _ = fs::copy(&path, dir.join(file_name));
        }
    }
}

#[tauri::command]
pub fn scan_models(app: AppHandle) -> Result<Vec<ModelInfo>, String> {
    let dir = resolve_models_dir(&app)?;
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    let mut models = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("gguf") {
            continue;
        }

        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let file_stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&file_name);

        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let quant = detect_quant(file_stem);
        let name = display_name(file_stem, &quant);

        models.push(ModelInfo {
            name,
            file_name,
            size_bytes: metadata.len(),
            quant,
        });
    }

    models.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(models)
}
