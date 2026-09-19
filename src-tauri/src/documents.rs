use std::fs;
use std::io::Read;
use std::path::Path;

use quick_xml::events::Event;
use quick_xml::reader::Reader;
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
        .add_filter("Documents", &["txt", "md", "docx", "pdf"])
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

    let raw = extract_text(&path)?;

    let budget = (CONTEXT_SIZE as usize).saturating_sub(RESERVED_TOKENS);
    let (content, truncated) = state.truncate_to_token_budget(&raw, budget)?;

    Ok(Some(LoadedDocument {
        file_name,
        content,
        truncated,
    }))
}

pub fn extract_text(path: &Path) -> Result<String, String> {
    match path.extension().and_then(|e| e.to_str()) {
        Some("docx") => extract_docx_text(path),
        Some("pdf") => extract_pdf_text(path),
        _ => fs::read_to_string(path).map_err(|e| format!("Failed to read file: {e}")),
    }
}

fn extract_pdf_text(path: &Path) -> Result<String, String> {
    let text = pdf_extract::extract_text(path).map_err(|e| format!("Failed to read PDF: {e}"))?;

    if text.trim().is_empty() {
        return Err(
            "This PDF has no extractable text (it may be a scanned document). \
             OCR isn't supported yet."
                .to_string(),
        );
    }

    Ok(text)
}

/// Extracts plain text from a .docx file's word/document.xml, keeping only
/// the content of <w:t> text runs and treating <w:p> (paragraph) boundaries
/// as newlines. Ignores formatting, images, tables structure, headers/footers.
fn extract_docx_text(path: &Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|e| format!("Failed to open file: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read .docx as zip: {e}"))?;

    let mut xml = String::new();
    archive
        .by_name("word/document.xml")
        .map_err(|e| format!("Invalid .docx file (no word/document.xml): {e}"))?
        .read_to_string(&mut xml)
        .map_err(|e| format!("Failed to read document.xml: {e}"))?;

    let mut reader = Reader::from_str(&xml);
    reader.config_mut().trim_text(false);

    let mut text = String::new();
    let mut in_text_run = false;
    let mut buf = Vec::new();

    loop {
        match reader
            .read_event_into(&mut buf)
            .map_err(|e| format!("Failed to parse document.xml: {e}"))?
        {
            Event::Start(e) if e.local_name().as_ref() == b"t" => in_text_run = true,
            Event::End(e) if e.local_name().as_ref() == b"t" => in_text_run = false,
            Event::Text(e) if in_text_run => {
                let decoded = e
                    .decode()
                    .map_err(|e| format!("Failed to decode text: {e}"))?;
                let unescaped = quick_xml::escape::unescape(&decoded)
                    .map_err(|e| format!("Failed to unescape text: {e}"))?;
                text.push_str(&unescaped);
            }
            Event::End(e) if e.local_name().as_ref() == b"p" => text.push('\n'),
            Event::Eof => break,
            _ => {}
        }
        buf.clear();
    }

    Ok(text)
}
