use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use llama_cpp_2::context::params::{LlamaContextParams, LlamaPoolingType};
use llama_cpp_2::context::LlamaContext;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel};
use self_cell::self_cell;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::documents::extract_text;
use crate::models::resolve_models_dir;

const CHUNK_TOKENS: usize = 300;
const CHUNK_OVERLAP_TOKENS: usize = 50;
const EMBED_CONTEXT_SIZE: u32 = 512;

self_cell!(
    struct EmbeddingModelWithContext {
        owner: LlamaModel,

        #[covariant]
        dependent: LlamaContext,
    }
);

struct LoadedEmbeddingModel {
    file_name: String,
    inner: EmbeddingModelWithContext,
}

pub struct RagState {
    backend: Arc<LlamaBackend>,
    loaded: Mutex<Option<LoadedEmbeddingModel>>,
}

// SAFETY: see the identical justification on `llm::LlmState` — all access
// goes through `RagState.loaded`'s Mutex, serializing every use of the
// underlying raw pointers.
unsafe impl Send for RagState {}
unsafe impl Sync for RagState {}

impl RagState {
    pub fn new(backend: Arc<LlamaBackend>) -> Self {
        Self {
            backend,
            loaded: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub fn load_embedding_model(
    app: AppHandle,
    state: State<RagState>,
    file_name: String,
) -> Result<(), String> {
    let dir = resolve_models_dir(&app)?;
    let path = dir.join(&file_name);
    if !path.is_file() {
        return Err(format!("Model file not found: {file_name}"));
    }

    let model_params = LlamaModelParams::default();
    let model = LlamaModel::load_from_file(&state.backend, &path, &model_params)
        .map_err(|e| format!("Failed to load embedding model: {e}"))?;

    if model.chat_template(None).is_ok() {
        return Err(format!(
            "{file_name} looks like a chat model (it has a chat template), not an \
             embedding model. Sideload a dedicated embedding model instead, e.g. \
             nomic-embed-text."
        ));
    }

    let backend = &state.backend;
    let inner = EmbeddingModelWithContext::try_new(model, |model| {
        let context_params = LlamaContextParams::default()
            .with_n_ctx(std::num::NonZeroU32::new(EMBED_CONTEXT_SIZE))
            .with_embeddings(true)
            .with_pooling_type(LlamaPoolingType::Mean);
        model
            .new_context(backend, context_params)
            .map_err(|e| format!("Failed to create embedding context: {e}"))
    })?;

    let mut loaded = state.loaded.lock().map_err(|e| e.to_string())?;
    *loaded = Some(LoadedEmbeddingModel { file_name, inner });
    Ok(())
}

#[tauri::command]
pub fn loaded_embedding_model(state: State<RagState>) -> Result<Option<String>, String> {
    let loaded = state.loaded.lock().map_err(|e| e.to_string())?;
    Ok(loaded.as_ref().map(|m| m.file_name.clone()))
}

fn embed_text(model: &LlamaModel, ctx: &mut LlamaContext, text: &str) -> Result<Vec<f32>, String> {
    let tokens = model
        .str_to_token(text, AddBos::Always)
        .map_err(|e| format!("Failed to tokenize: {e}"))?;

    if tokens.is_empty() {
        return Err("Text produced no tokens".to_string());
    }
    if tokens.len() > EMBED_CONTEXT_SIZE as usize {
        return Err("Chunk too long for embedding context".to_string());
    }

    ctx.clear_kv_cache();

    let mut batch = LlamaBatch::new(EMBED_CONTEXT_SIZE as usize, 1);
    let last_index = tokens.len() as i32 - 1;
    for (i, token) in (0_i32..).zip(tokens.iter()) {
        let is_last = i == last_index;
        batch
            .add(*token, i, &[0], is_last)
            .map_err(|e| format!("Failed to build batch: {e}"))?;
    }

    ctx.decode(&mut batch)
        .map_err(|e| format!("Failed to decode: {e}"))?;

    let embedding = ctx
        .embeddings_seq_ith(0)
        .map_err(|e| format!("Failed to extract embedding: {e}"))?;

    Ok(normalize(embedding))
}

fn normalize(v: &[f32]) -> Vec<f32> {
    let norm = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm == 0.0 {
        return v.to_vec();
    }
    v.iter().map(|x| x / norm).collect()
}

fn chunk_text(model: &LlamaModel, text: &str) -> Result<Vec<String>, String> {
    let tokens = model
        .str_to_token(text, AddBos::Never)
        .map_err(|e| format!("Failed to tokenize for chunking: {e}"))?;

    if tokens.is_empty() {
        return Ok(vec![]);
    }

    let mut chunks = Vec::new();
    let mut start = 0usize;
    let mut decoder = encoding_rs::UTF_8.new_decoder();

    while start < tokens.len() {
        let end = (start + CHUNK_TOKENS).min(tokens.len());
        let mut chunk = String::new();
        for token in &tokens[start..end] {
            let piece = model
                .token_to_piece(*token, &mut decoder, true, None)
                .map_err(|e| format!("Failed to detokenize chunk: {e}"))?;
            chunk.push_str(&piece);
        }
        chunks.push(chunk);

        if end == tokens.len() {
            break;
        }
        start = end.saturating_sub(CHUNK_OVERLAP_TOKENS);
    }

    Ok(chunks)
}

#[derive(Serialize, Deserialize, Clone)]
struct IndexedChunk {
    source_file: String,
    text: String,
    vector: Vec<f32>,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum IndexStatus {
    NotIndexed,
    Indexing,
    Indexed,
}

fn default_status_for_migration(chunks: &[IndexedChunk]) -> IndexStatus {
    // Indexes written before `status` existed have no field to deserialize,
    // so infer it from whether they already have chunks — this is what
    // makes old indexes load correctly as "Indexed" with no explicit
    // migration step.
    if chunks.is_empty() {
        IndexStatus::NotIndexed
    } else {
        IndexStatus::Indexed
    }
}

#[derive(Serialize, Deserialize)]
struct RagIndex {
    id: String,
    name: String,
    folder_path: String,
    #[serde(default)]
    chunks: Vec<IndexedChunk>,
    #[serde(default = "unknown_status_marker")]
    status: Option<IndexStatus>,
}

fn unknown_status_marker() -> Option<IndexStatus> {
    None
}

impl RagIndex {
    fn resolved_status(&self) -> IndexStatus {
        self.status
            .unwrap_or_else(|| default_status_for_migration(&self.chunks))
    }
}

#[derive(Serialize)]
pub struct RagIndexSummary {
    id: String,
    name: String,
    folder_path: String,
    chunk_count: usize,
    status: IndexStatus,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    skipped_files: Vec<String>,
}

fn resolve_rag_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    let dir = base.join("rag_indexes");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn index_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("Invalid index id".to_string());
    }
    Ok(resolve_rag_dir(app)?.join(format!("{id}.json")))
}

fn uuid_like() -> String {
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};
    static COUNTER: AtomicU32 = AtomicU32::new(0);
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let counter = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{millis:x}-{counter:x}")
}

fn collect_text_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else {
        return files;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            files.extend(collect_text_files(&path));
        } else if matches!(
            path.extension().and_then(|e| e.to_str()),
            Some("txt") | Some("md") | Some("docx") | Some("pdf")
        ) {
            files.push(path);
        }
    }
    files
}

/// Lets the user pick a folder and adds it to the knowledge base as
/// "not indexed" — indexing itself happens separately via `index_folder`,
/// so a folder can exist and be removed/renamed without requiring an
/// embedding model to be loaded yet.
#[tauri::command]
pub async fn add_folder(app: AppHandle) -> Result<Option<RagIndexSummary>, String> {
    let folder_path = app.dialog().file().blocking_pick_folder();
    let Some(folder_path) = folder_path else {
        return Ok(None);
    };
    let folder_path = folder_path.into_path().map_err(|e| e.to_string())?;

    let name = folder_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled folder")
        .to_string();

    let id = uuid_like();
    let index = RagIndex {
        id: id.clone(),
        name,
        folder_path: folder_path.to_string_lossy().to_string(),
        chunks: Vec::new(),
        status: Some(IndexStatus::NotIndexed),
    };

    let summary = RagIndexSummary {
        id: index.id.clone(),
        name: index.name.clone(),
        folder_path: index.folder_path.clone(),
        chunk_count: 0,
        status: IndexStatus::NotIndexed,
        skipped_files: Vec::new(),
    };

    let path = index_path(&app, &id)?;
    let json = serde_json::to_string(&index).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(Some(summary))
}

#[derive(Clone, Serialize)]
struct IndexProgressEvent<'a> {
    id: &'a str,
    files_done: usize,
    files_total: usize,
}

#[derive(Clone, Serialize)]
struct IndexDoneEvent<'a> {
    id: &'a str,
    chunk_count: usize,
}

#[derive(Clone, Serialize)]
struct IndexErrorEvent<'a> {
    id: &'a str,
    message: String,
}

/// Embeds every supported file in a previously-added folder (see
/// `add_folder`) and marks it indexed, running on a background thread so
/// the command returns immediately; progress is reported via
/// `rag-index-progress`/`rag-index-done`/`rag-index-error` events, the same
/// pattern `llm::send_message` uses for chat generation.
///
/// The embedding model's mutex is acquired and released once per chunk
/// (not held for the whole run), so a `rag_search` against a different,
/// already-indexed folder is only ever blocked behind a single chunk's
/// embedding time, not the entire indexing job.
#[tauri::command]
pub fn index_folder(app: AppHandle, id: String) -> Result<(), String> {
    let path = index_path(&app, &id)?;
    let raw = fs::read_to_string(&path).map_err(|e| format!("Folder not found: {e}"))?;
    let mut index: RagIndex = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    index.status = Some(IndexStatus::Indexing);
    let json = serde_json::to_string(&index).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let result = run_indexing(&app, &path, &mut index, &id);
        match result {
            Ok(chunk_count) => {
                let _ = app.emit("rag-index-done", IndexDoneEvent { id: &id, chunk_count });
            }
            Err(message) => {
                // Revert to not-indexed on failure so the folder doesn't get
                // stuck showing "Indexing" forever; any partial progress
                // (chunks from files processed before the failure) is
                // discarded rather than saved half-finished.
                index.status = Some(IndexStatus::NotIndexed);
                index.chunks.clear();
                if let Ok(json) = serde_json::to_string(&index) {
                    let _ = fs::write(&path, json);
                }
                let _ = app.emit("rag-index-error", IndexErrorEvent { id: &id, message });
            }
        }
    });

    Ok(())
}

fn run_indexing(
    app: &AppHandle,
    path: &Path,
    index: &mut RagIndex,
    id: &str,
) -> Result<usize, String> {
    let files = collect_text_files(Path::new(&index.folder_path));
    if files.is_empty() {
        return Err("No .txt, .md, .docx, or .pdf files found in that folder".to_string());
    }

    let state = app.state::<RagState>();
    let mut chunks = Vec::new();
    let mut skipped = Vec::new();

    for (done, file) in files.iter().enumerate() {
        let source_file = file
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("document")
            .to_string();

        let raw = match extract_text(file) {
            Ok(text) => text,
            Err(e) => {
                skipped.push(format!("{source_file}: {e}"));
                continue;
            }
        };

        // Locks per-file (not for the whole run), so a concurrent
        // rag_search only ever waits behind at most one file's worth of
        // embedding work. The guard is dropped at the end of this block,
        // before the progress event is emitted.
        {
            let mut guard = state.loaded.lock().map_err(|e| e.to_string())?;
            let loaded = guard.as_mut().ok_or("No embedding model loaded")?;
            loaded.inner.with_dependent_mut(|model, ctx| -> Result<(), String> {
                for chunk in chunk_text(model, &raw)? {
                    let vector = embed_text(model, ctx, &chunk)?;
                    chunks.push(IndexedChunk {
                        source_file: source_file.clone(),
                        text: chunk,
                        vector,
                    });
                }
                Ok(())
            })?;
        }

        let _ = app.emit(
            "rag-index-progress",
            IndexProgressEvent {
                id,
                files_done: done + 1,
                files_total: files.len(),
            },
        );
    }

    if chunks.is_empty() {
        return Err(if skipped.is_empty() {
            "No text could be extracted from any file in that folder".to_string()
        } else {
            format!(
                "No text could be extracted from any file in that folder:\n{}",
                skipped.join("\n")
            )
        });
    }

    let chunk_count = chunks.len();
    index.chunks = chunks;
    index.status = Some(IndexStatus::Indexed);

    let json = serde_json::to_string(&index).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;

    Ok(chunk_count)
}

#[tauri::command]
pub fn list_rag_indexes(app: AppHandle) -> Result<Vec<RagIndexSummary>, String> {
    let dir = resolve_rag_dir(&app)?;
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    let mut summaries = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if let Ok(index) = serde_json::from_str::<RagIndex>(&raw) {
            summaries.push(RagIndexSummary {
                status: index.resolved_status(),
                id: index.id,
                name: index.name,
                folder_path: index.folder_path,
                chunk_count: index.chunks.len(),
                skipped_files: Vec::new(),
            });
        }
    }
    Ok(summaries)
}

#[tauri::command]
pub fn delete_rag_index(app: AppHandle, id: String) -> Result<(), String> {
    let path = index_path(&app, &id)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn rename_rag_index(app: AppHandle, id: String, name: String) -> Result<(), String> {
    let path = index_path(&app, &id)?;
    let raw = fs::read_to_string(&path).map_err(|e| format!("Folder not found: {e}"))?;
    let mut index: RagIndex = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    index.name = name;
    let json = serde_json::to_string(&index).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct RagResult {
    source_file: String,
    text: String,
    score: f32,
}

#[tauri::command]
pub fn rag_search(
    app: AppHandle,
    state: State<RagState>,
    index_id: String,
    query: String,
    top_k: usize,
) -> Result<Vec<RagResult>, String> {
    let path = index_path(&app, &index_id)?;
    let raw = fs::read_to_string(&path).map_err(|e| format!("Index not found: {e}"))?;
    let index: RagIndex = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    let mut loaded = state.loaded.lock().map_err(|e| e.to_string())?;
    let loaded = loaded.as_mut().ok_or("No embedding model loaded")?;

    let query_vector = loaded
        .inner
        .with_dependent_mut(|model, ctx| embed_text(model, ctx, &query))?;

    let mut scored: Vec<RagResult> = index
        .chunks
        .into_iter()
        .map(|chunk| {
            let score = cosine_similarity(&query_vector, &chunk.vector);
            RagResult {
                source_file: chunk.source_file,
                text: chunk.text,
                score,
            }
        })
        .collect();

    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);

    Ok(scored)
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}
