use std::num::NonZeroU32;
use std::sync::Mutex;

use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::LlamaModel;
use tauri::{AppHandle, State};

use crate::models::resolve_models_dir;

const CONTEXT_SIZE: u32 = 4096;

pub struct LlmState {
    backend: LlamaBackend,
    loaded: Mutex<Option<LoadedModel>>,
}

struct LoadedModel {
    file_name: String,
    #[allow(dead_code)]
    model: LlamaModel,
}

impl LlmState {
    pub fn new() -> Result<Self, String> {
        let backend = LlamaBackend::init().map_err(|e| e.to_string())?;
        Ok(Self {
            backend,
            loaded: Mutex::new(None),
        })
    }
}

#[tauri::command]
pub fn load_model(app: AppHandle, state: State<LlmState>, file_name: String) -> Result<(), String> {
    let dir = resolve_models_dir(&app)?;
    let path = dir.join(&file_name);
    if !path.is_file() {
        return Err(format!("Model file not found: {file_name}"));
    }

    let model_params = LlamaModelParams::default();
    let model = LlamaModel::load_from_file(&state.backend, &path, &model_params)
        .map_err(|e| format!("Failed to load model: {e}"))?;

    let context_params =
        LlamaContextParams::default().with_n_ctx(NonZeroU32::new(CONTEXT_SIZE));
    model
        .new_context(&state.backend, context_params)
        .map_err(|e| format!("Failed to create context: {e}"))?;

    let mut loaded = state.loaded.lock().map_err(|e| e.to_string())?;
    *loaded = Some(LoadedModel { file_name, model });
    Ok(())
}

#[tauri::command]
pub fn unload_model(state: State<LlmState>) -> Result<(), String> {
    let mut loaded = state.loaded.lock().map_err(|e| e.to_string())?;
    *loaded = None;
    Ok(())
}

#[tauri::command]
pub fn loaded_model(state: State<LlmState>) -> Result<Option<String>, String> {
    let loaded = state.loaded.lock().map_err(|e| e.to_string())?;
    Ok(loaded.as_ref().map(|m| m.file_name.clone()))
}
