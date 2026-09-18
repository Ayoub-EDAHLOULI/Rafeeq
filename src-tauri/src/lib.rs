mod documents;
mod llm;
mod models;
mod offline_audit;
mod profiles;
mod rag;
mod sessions;

use std::sync::Arc;

use llama_cpp_2::llama_backend::LlamaBackend;
use llm::LlmState;
use rag::RagState;
use tauri::{Manager, Theme};

#[tauri::command]
fn set_window_theme(window: tauri::WebviewWindow, theme: String) {
    let theme = match theme.as_str() {
        "dark" => Some(Theme::Dark),
        _ => Some(Theme::Light),
    };
    let _ = window.set_theme(theme);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            set_window_theme,
            models::scan_models,
            models::models_dir,
            llm::load_model,
            llm::unload_model,
            llm::loaded_model,
            llm::send_message,
            llm::stop_generation,
            offline_audit::offline_audit,
            documents::pick_document,
            sessions::save_session,
            sessions::list_sessions,
            sessions::load_session,
            sessions::delete_session,
            profiles::save_profile,
            profiles::list_profiles,
            profiles::delete_profile,
            rag::load_embedding_model,
            rag::loaded_embedding_model,
            rag::pick_and_index_folder,
            rag::list_rag_indexes,
            rag::delete_rag_index,
            rag::rag_search
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_theme(Some(Theme::Light));
            let backend =
                Arc::new(LlamaBackend::init().expect("failed to init llama backend"));
            app.manage(LlmState::new(backend.clone()));
            app.manage(RagState::new(backend));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
