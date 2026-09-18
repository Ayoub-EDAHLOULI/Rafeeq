use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone)]
pub struct ModelProfile {
    id: String,
    name: String,
    model_file: String,
    created_at: u64,
}

fn resolve_profiles_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    let dir = base.join("profiles");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn profile_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("Invalid profile id".to_string());
    }
    Ok(resolve_profiles_dir(app)?.join(format!("{id}.json")))
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn save_profile(app: AppHandle, name: String, model_file: String) -> Result<ModelProfile, String> {
    let id = uuid_like();
    let profile = ModelProfile {
        id: id.clone(),
        name,
        model_file,
        created_at: now_millis(),
    };

    let path = profile_path(&app, &id)?;
    let json = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(profile)
}

#[tauri::command]
pub fn list_profiles(app: AppHandle) -> Result<Vec<ModelProfile>, String> {
    let dir = resolve_profiles_dir(&app)?;
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    let mut profiles = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if let Ok(profile) = serde_json::from_str::<ModelProfile>(&raw) {
            profiles.push(profile);
        }
    }

    profiles.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    Ok(profiles)
}

#[tauri::command]
pub fn delete_profile(app: AppHandle, id: String) -> Result<(), String> {
    let path = profile_path(&app, &id)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Small dependency-free unique id: current time plus a per-process counter,
/// good enough for locally generated file names where global uniqueness
/// across machines is not required.
fn uuid_like() -> String {
    use std::sync::atomic::{AtomicU32, Ordering};
    static COUNTER: AtomicU32 = AtomicU32::new(0);
    let counter = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{:x}-{:x}", now_millis(), counter)
}
