mod llm;
mod models;

use llm::LlmState;
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
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            set_window_theme,
            models::scan_models,
            models::models_dir,
            llm::load_model,
            llm::unload_model,
            llm::loaded_model
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_theme(Some(Theme::Light));
            app.manage(LlmState::new().expect("failed to init llama backend"));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
