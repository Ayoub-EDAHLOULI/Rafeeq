use std::num::NonZeroU32;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::context::LlamaContext;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaChatMessage, LlamaModel};
use llama_cpp_2::sampling::LlamaSampler;
use self_cell::self_cell;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use encoding_rs::UTF_8;

use crate::models::resolve_models_dir;

const CONTEXT_SIZE: u32 = 4096;
const MAX_RESPONSE_TOKENS: usize = 1024;

self_cell!(
    struct ModelWithContext {
        owner: LlamaModel,

        #[covariant]
        dependent: LlamaContext,
    }
);

struct LoadedModel {
    file_name: String,
    inner: ModelWithContext,
}

pub struct LlmState {
    backend: LlamaBackend,
    loaded: Mutex<Option<LoadedModel>>,
    stop_flag: Arc<AtomicBool>,
}

// SAFETY: llama.cpp's model/context types are not thread-affine, only
// unsynchronized-concurrent-access-unsafe. All access to `loaded` goes
// through `LlmState.loaded`'s Mutex, which serializes every call into the
// model/context, so no two threads ever touch the raw pointers inside
// concurrently.
unsafe impl Send for LlmState {}
unsafe impl Sync for LlmState {}

impl LlmState {
    pub fn new() -> Result<Self, String> {
        let backend = LlamaBackend::init().map_err(|e| e.to_string())?;
        Ok(Self {
            backend,
            loaded: Mutex::new(None),
            stop_flag: Arc::new(AtomicBool::new(false)),
        })
    }
}

#[derive(Clone, Serialize)]
struct ChatTokenEvent<'a> {
    request_id: &'a str,
    token: String,
}

#[derive(Clone, Serialize)]
struct ChatDoneEvent<'a> {
    request_id: &'a str,
}

#[derive(Clone, Serialize)]
struct ChatErrorEvent<'a> {
    request_id: &'a str,
    message: String,
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

    let backend = &state.backend;
    let inner = ModelWithContext::try_new(model, |model| {
        let context_params =
            LlamaContextParams::default().with_n_ctx(NonZeroU32::new(CONTEXT_SIZE));
        model
            .new_context(backend, context_params)
            .map_err(|e| format!("Failed to create context: {e}"))
    })?;

    let mut loaded = state.loaded.lock().map_err(|e| e.to_string())?;
    *loaded = Some(LoadedModel { file_name, inner });
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

#[tauri::command]
pub fn send_message(
    app: AppHandle,
    state: State<LlmState>,
    request_id: String,
    prompt: String,
) -> Result<(), String> {
    if state.loaded.lock().map_err(|e| e.to_string())?.is_none() {
        return Err("No model loaded".to_string());
    }

    state.stop_flag.store(false, Ordering::SeqCst);
    let stop_flag = state.stop_flag.clone();

    std::thread::spawn(move || {
        let state = app.state::<LlmState>();
        let token_request_id = request_id.clone();
        let result = (|| {
            let mut loaded = state.loaded.lock().map_err(|e| e.to_string())?;
            let loaded = loaded.as_mut().ok_or("No model loaded")?;
            loaded.inner.with_dependent_mut(|model, ctx| {
                generate(model, ctx, &prompt, &stop_flag, |token| {
                    let _ = app.emit(
                        "chat-token",
                        ChatTokenEvent {
                            request_id: &token_request_id,
                            token,
                        },
                    );
                })
            })
        })();

        match result {
            Ok(()) => {
                let _ = app.emit(
                    "chat-done",
                    ChatDoneEvent {
                        request_id: &request_id,
                    },
                );
            }
            Err(message) => {
                let _ = app.emit(
                    "chat-error",
                    ChatErrorEvent {
                        request_id: &request_id,
                        message,
                    },
                );
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_generation(state: State<LlmState>) {
    state.stop_flag.store(true, Ordering::SeqCst);
}

fn generate(
    model: &LlamaModel,
    ctx: &mut LlamaContext,
    prompt: &str,
    stop_flag: &AtomicBool,
    mut on_token: impl FnMut(String),
) -> Result<(), String> {
    // Each call is currently a standalone exchange (no conversation history
    // is threaded through), so the previous turn's KV cache state must be
    // cleared or decode() fails once the context fills up across turns.
    ctx.clear_kv_cache();

    let tmpl = model
        .chat_template(None)
        .map_err(|e| format!("Model has no chat template: {e}"))?;
    let message = LlamaChatMessage::new("user".to_string(), prompt.to_string())
        .map_err(|e| format!("Invalid chat message: {e}"))?;
    let formatted = model
        .apply_chat_template(&tmpl, &[message], true)
        .map_err(|e| format!("Failed to apply chat template: {e}"))?;

    let tokens = model
        .str_to_token(&formatted, AddBos::Always)
        .map_err(|e| format!("Failed to tokenize prompt: {e}"))?;

    if tokens.is_empty() {
        return Err("Prompt produced no tokens".to_string());
    }

    let mut batch = LlamaBatch::new(CONTEXT_SIZE as usize, 1);
    let last_index = tokens.len() as i32 - 1;
    for (i, token) in (0_i32..).zip(tokens.iter()) {
        let is_last = i == last_index;
        batch
            .add(*token, i, &[0], is_last)
            .map_err(|e| format!("Failed to build prompt batch: {e}"))?;
    }

    ctx.decode(&mut batch)
        .map_err(|e| format!("Failed to decode prompt: {e}"))?;

    let mut sampler = LlamaSampler::chain_simple([
        LlamaSampler::min_p(0.05, 1),
        LlamaSampler::temp(0.8),
        LlamaSampler::dist(1234),
    ]);
    let mut decoder = UTF_8.new_decoder();

    let mut n_cur = batch.n_tokens();

    for _ in 0..MAX_RESPONSE_TOKENS {
        if stop_flag.load(Ordering::SeqCst) {
            break;
        }

        let token = sampler.sample(ctx, batch.n_tokens() - 1);
        sampler.accept(token);

        if model.is_eog_token(token) {
            break;
        }

        let piece = model
            .token_to_piece(token, &mut decoder, true, None)
            .map_err(|e| format!("Failed to detokenize response: {e}"))?;
        on_token(piece);

        batch.clear();
        batch
            .add(token, n_cur, &[0], true)
            .map_err(|e| format!("Failed to build response batch: {e}"))?;
        n_cur += 1;

        ctx.decode(&mut batch)
            .map_err(|e| format!("Failed to decode response token: {e}"))?;
    }

    Ok(())
}
