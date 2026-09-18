use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionMessage {
    id: String,
    role: String,
    content: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Session {
    id: String,
    title: String,
    mode: String,
    model_file: String,
    messages: Vec<SessionMessage>,
    created_at: u64,
    updated_at: u64,
}

#[derive(Serialize)]
pub struct SessionSummary {
    id: String,
    title: String,
    mode: String,
    model_file: String,
    updated_at: u64,
}

fn resolve_sessions_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    let dir = base.join("sessions");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn session_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("Invalid session id".to_string());
    }
    Ok(resolve_sessions_dir(app)?.join(format!("{id}.json")))
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn save_session(
    app: AppHandle,
    id: String,
    title: String,
    mode: String,
    model_file: String,
    messages: Vec<SessionMessage>,
    created_at: Option<u64>,
) -> Result<(), String> {
    let path = session_path(&app, &id)?;
    let updated_at = now_millis();
    let created_at = created_at.unwrap_or(updated_at);

    let session = Session {
        id,
        title,
        mode,
        model_file,
        messages,
        created_at,
        updated_at,
    };

    let json = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_sessions(app: AppHandle) -> Result<Vec<SessionSummary>, String> {
    let dir = resolve_sessions_dir(&app)?;
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    let mut sessions = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let session: Session = match serde_json::from_str(&raw) {
            Ok(s) => s,
            Err(_) => continue,
        };

        sessions.push(SessionSummary {
            id: session.id,
            title: session.title,
            mode: session.mode,
            model_file: session.model_file,
            updated_at: session.updated_at,
        });
    }

    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(sessions)
}

#[tauri::command]
pub fn load_session(app: AppHandle, id: String) -> Result<Session, String> {
    let path = session_path(&app, &id)?;
    let raw = fs::read_to_string(&path).map_err(|e| format!("Session not found: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_session(app: AppHandle, id: String) -> Result<(), String> {
    let path = session_path(&app, &id)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
