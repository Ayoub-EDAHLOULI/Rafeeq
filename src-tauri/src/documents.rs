use std::fs;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::llm::{LlmState, CONTEXT_SIZE};

/// Reserve room in the context for the conversation and the model's reply
/// on top of whatever document text is loaded.
const RESERVED_TOKENS: usize = 1024;

#[derive(Serialize)]
pub struct LoadedDocument {
    file_name: String,
    content: String,
    truncated: bool,
}

#[tauri::command]
pub async fn pick_document(
    app: AppHandle,
    state: State<'_, LlmState>,
) -> Result<Option<LoadedDocument>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Text documents", &["txt", "md"])
        .blocking_pick_file();

    let Some(file_path) = file_path else {
        return Ok(None);
    };

    let path = file_path.into_path().map_err(|e| e.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document")
        .to_string();

    let raw = fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {e}"))?;

    let budget = (CONTEXT_SIZE as usize).saturating_sub(RESERVED_TOKENS);
    let (content, truncated) = state.truncate_to_token_budget(&raw, budget)?;

    Ok(Some(LoadedDocument {
        file_name,
        content,
        truncated,
    }))
}
