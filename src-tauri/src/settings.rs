use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::llm::{DEFAULT_MAX_RESPONSE_TOKENS, DEFAULT_TEMPERATURE};
use crate::rag::{DEFAULT_CHUNK_OVERLAP_TOKENS, DEFAULT_CHUNK_TOKENS, DEFAULT_PASSAGES_PER_QUESTION};
use crate::sessions::resolve_sessions_dir;

fn default_theme() -> String {
    "system".to_string()
}

fn default_keep_history() -> bool {
    true
}

fn default_cpu_threads() -> u32 {
    4
}

fn default_max_response_tokens() -> usize {
    DEFAULT_MAX_RESPONSE_TOKENS
}

fn default_temperature() -> f32 {
    DEFAULT_TEMPERATURE
}

fn default_chunk_size() -> usize {
    DEFAULT_CHUNK_TOKENS
}

fn default_chunk_overlap() -> usize {
    DEFAULT_CHUNK_OVERLAP_TOKENS
}

fn default_passages_per_question() -> usize {
    DEFAULT_PASSAGES_PER_QUESTION
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    theme: String,
    #[serde(default = "default_keep_history")]
    keep_history: bool,
    #[serde(default = "default_cpu_threads")]
    cpu_threads: u32,
    #[serde(default = "default_max_response_tokens")]
    max_response_tokens: usize,
    #[serde(default = "default_temperature")]
    default_temperature: f32,
    #[serde(default = "default_chunk_size")]
    chunk_size: usize,
    #[serde(default = "default_chunk_overlap")]
    chunk_overlap: usize,
    #[serde(default = "default_passages_per_question")]
    passages_per_question: usize,
}

impl AppSettings {
    pub fn chunk_size(&self) -> usize {
        self.chunk_size
    }

    pub fn chunk_overlap(&self) -> usize {
        self.chunk_overlap
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            keep_history: default_keep_history(),
            cpu_threads: default_cpu_threads(),
            max_response_tokens: default_max_response_tokens(),
            default_temperature: default_temperature(),
            chunk_size: default_chunk_size(),
            chunk_overlap: default_chunk_overlap(),
            passages_per_question: default_passages_per_question(),
        }
    }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    Ok(base.join("settings.json"))
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(&app)?;
    let Ok(raw) = fs::read_to_string(&path) else {
        return Ok(AppSettings::default());
    };
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_all_sessions(app: AppHandle) -> Result<(), String> {
    let dir = resolve_sessions_dir(&app)?;
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
