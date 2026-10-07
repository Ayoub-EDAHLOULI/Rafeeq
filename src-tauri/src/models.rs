use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager, State};

use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::LlamaModel;

use crate::llm::LlmState;

#[derive(Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModelType {
    Chat,
    Embedding,
    Unknown,
}

#[derive(Serialize)]
pub struct ModelInfo {
    name: String,
    file_name: String,
    size_bytes: u64,
    quant: Option<String>,
    model_type: ModelType,
}

/// Cache key: a model file is only re-probed when its size or modified time
/// changes, so replacing a file (e.g. re-downloading it) invalidates the
/// cached type without needing an explicit "clear cache" action.
#[derive(Serialize, Deserialize, Clone, PartialEq)]
struct CacheKey {
    size_bytes: u64,
    modified_millis: u64,
}

#[derive(Serialize, Deserialize, Clone)]
struct CacheEntry {
    key: CacheKey,
    #[serde(rename = "type")]
    model_type: CachedModelType,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
enum CachedModelType {
    Chat,
    Embedding,
}

impl From<CachedModelType> for ModelType {
    fn from(cached: CachedModelType) -> Self {
        match cached {
            CachedModelType::Chat => ModelType::Chat,
            CachedModelType::Embedding => ModelType::Embedding,
        }
    }
}

fn cache_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    Ok(base.join("model_type_cache.json"))
}

fn load_cache(app: &AppHandle) -> HashMap<String, CacheEntry> {
    let Ok(path) = cache_path(app) else {
        return HashMap::new();
    };
    let Ok(raw) = fs::read_to_string(&path) else {
        return HashMap::new();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn save_cache(app: &AppHandle, cache: &HashMap<String, CacheEntry>) {
    let Ok(path) = cache_path(app) else { return };
    let Ok(json) = serde_json::to_string(cache) else {
        return;
    };
    let _ = fs::write(&path, json);
}

/// Probes whether a .gguf file is a chat model (has a chat template) or an
/// embedding model (no chat template), the same check `load_model` and
/// `load_embedding_model` already use as a load-time guard. Loads with
/// `vocab_only`, so llama.cpp reads only the vocabulary and metadata
/// (including the chat template, if any) without allocating the model's
/// tensor weights — unlike a real chat/embedding load, this doesn't scale
/// with model size, so probing a large model here is cheap regardless of
/// how much RAM is already committed to an actively loaded model.
fn probe_model_type(backend: &llama_cpp_2::llama_backend::LlamaBackend, path: &std::path::Path) -> ModelType {
    let model_params = LlamaModelParams::default().with_vocab_only(true);
    match LlamaModel::load_from_file(backend, path, &model_params) {
        Ok(model) => {
            if model.chat_template(None).is_ok() {
                ModelType::Chat
            } else {
                ModelType::Embedding
            }
        }
        Err(_) => ModelType::Unknown,
    }
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
pub fn scan_models(app: AppHandle, llm_state: State<LlmState>) -> Result<Vec<ModelInfo>, String> {
    let dir = resolve_models_dir(&app)?;
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    let mut cache = load_cache(&app);
    let mut cache_dirty = false;

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

        let key = CacheKey {
            size_bytes: metadata.len(),
            modified_millis: metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        };

        let model_type = match cache.get(&file_name) {
            Some(cached) if cached.key == key => cached.model_type.into(),
            _ => {
                let probed = probe_model_type(llm_state.backend(), &path);
                if let ModelType::Chat | ModelType::Embedding = probed {
                    let cached_type = if matches!(probed, ModelType::Chat) {
                        CachedModelType::Chat
                    } else {
                        CachedModelType::Embedding
                    };
                    cache.insert(
                        file_name.clone(),
                        CacheEntry {
                            key,
                            model_type: cached_type,
                        },
                    );
                    cache_dirty = true;
                }
                probed
            }
        };

        models.push(ModelInfo {
            name,
            file_name,
            size_bytes: metadata.len(),
            quant,
            model_type,
        });
    }

    if cache_dirty {
        save_cache(&app, &cache);
    }

    models.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(models)
}
