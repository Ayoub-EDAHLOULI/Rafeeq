# Rafeeq (رفيق)

> A fully offline, local AI assistant for code help, document Q&A, and summarization — built for air-gapped and network-restricted machines.

Rafeeq ("companion" in Arabic) runs a small language model entirely on-device using [llama.cpp](https://github.com/ggerganov/llama.cpp), so it works identically with zero internet connection as with a great one. No API keys, no cloud calls, no telemetry — the model, the runtime, and your data never leave the machine.

Part of a family of offline-first desktop tools: [Naskh](#) (OCR/document digitizer), [Offline Developer Toolbox](#), [Offline File Converter](#).

---

## Why

Some development and work environments — corporate VMs, air-gapped networks, regulated industries — block access to cloud AI tools entirely, even though that's exactly where a coding/writing assistant would help most. Rafeeq exists to close that gap: a genuinely useful assistant for machines that will never see the open internet.

## Features

- **Local chat** — prompt in, streamed response out, powered by a small quantized model running on CPU
- **Model manager** — point Rafeeq at a sideloaded `.gguf` file, swap models, see size/quantization info
- **Code-help mode** — paste or select code, ask questions, get explanations or suggestions (no code execution)
- **Document Q&A & summarization** — load a local `.txt`, `.md`, `.docx`, or `.pdf` file and ask questions about its contents or get a summary; long documents are truncated to fit the model's context. Scanned/image-only PDFs with no text layer aren't supported yet (no OCR)
- **Local RAG** — index a folder of `.txt`/`.md`/`.docx`/`.pdf` documents with a sideloaded embedding model, then ask questions answered from the most relevant retrieved passages
- **Session history** — conversations are saved automatically and can be resumed from the sidebar
- **Model profiles** — save named shortcuts to sideloaded models for quick switching
- **Offline verification** — a hand-maintained allowlist gate plus an in-app indicator confirm no network-capable plugin is registered in the build

### Planned

- OCR for scanned PDFs, via integration with [Naskh](#) so scanned/OCR'd documents can flow directly into Rafeeq's context

## Verifiably offline

Rafeeq makes **zero network calls at runtime**, by design and by construction — there is no code path in the app that reaches the network. This is testable yourself: block network access at the OS level (firewall rule, disabled adapter, or an air-gapped VM) and Rafeeq will run identically.

## Tech stack

| Layer             | Technology                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Shell / packaging | [Tauri](https://tauri.app)                                                                                         |
| Frontend          | React + TypeScript                                                                                                 |
| Backend           | Rust                                                                                                               |
| Inference engine  | [llama.cpp](https://github.com/ggerganov/llama.cpp) via [`llama-cpp-rs`](https://github.com/eugenehp/llama-cpp-rs) |
| Model format      | GGUF (quantized)                                                                                                   |

## Default model

Rafeeq ships without bundled model weights — you sideload a `.gguf` file yourself (see [Getting a model](#getting-a-model) below). This keeps the app installer small and lets you pick the model that fits your hardware and licensing needs.

Recommended default: **[Phi-4-mini-instruct](https://huggingface.co/microsoft/Phi-4-mini-instruct)** (3.8B, MIT license), Q4_K_M quantization (~2.3GB), which runs on 8GB RAM machines with no GPU.

| Model                | Size (Q4_K_M) | License    | Notes                                                 |
| -------------------- | ------------- | ---------- | ----------------------------------------------------- |
| Phi-4-mini-instruct  | ~2.3 GB       | MIT        | Default — strong reasoning for its size, 128K context |
| Qwen2.5 / 3.5 (3–4B) | ~2.3–2.6 GB   | Apache 2.0 | Stronger multilingual support                         |

## Requirements

- **RAM:** 8GB minimum, 16GB recommended
- **CPU:** any x86 CPU with AVX2 (Intel Haswell / AMD Excavator, 2013+) or Apple Silicon — no GPU required
- **Disk:** a few MB for the app (~3MB installer), plus the size of whichever model(s) you sideload

## Getting a model

Rafeeq needs at least one `.gguf` model file before it can chat.

1. Download a model — e.g. [`Phi-4-mini-instruct-Q4_K_M.gguf`](https://huggingface.co/microsoft/Phi-4-mini-instruct) from Hugging Face on any machine with internet access
2. Transfer it to the target machine (USB drive, internal file share — whatever your environment allows)
3. Place it in Rafeeq's model directory. The easiest way to find it is the **Open models folder** button on the Models screen; the paths are:
   - **Windows:** `%LOCALAPPDATA%\com.ayoubedahlouli.rafeeq\models\`
   - **macOS:** `~/Library/Application Support/com.ayoubedahlouli.rafeeq/models/`
   - **Linux:** `~/.local/share/com.ayoubedahlouli.rafeeq/models/`

   The starter-model build uses its own folder: replace `com.ayoubedahlouli.rafeeq` with `com.ayoubedahlouli.rafeeq.bundled`.
4. Launch Rafeeq — it will detect the model automatically in the Model Manager

No internet access is required on the target machine at any point after the file is copied.

For local RAG, sideload a second, small embedding model (e.g. `nomic-embed-text-v1.5`) into the same models directory — embedding models are not instruction-tuned for chat, so they're kept separate from your chat model and selected from RAG mode in the app.

## Installation

### From release

Download the latest installer for your platform from [Releases](https://github.com/Ayoub-EDAHLOULI/Rafeeq/releases) (Windows `.exe` and `.msi` for now). Two variants are published:

- **Rafeeq** — the standard, lean installer (~3MB). No model included; you sideload one yourself (see [Getting a model](#getting-a-model)). This is the right choice for air-gapped machines, since it doesn't force a large download over a restricted transfer channel.
- **Rafeeq (with starter model)** — a larger installer (~480MB) that bundles a small starter model (Qwen2.5-0.5B-Instruct, Q4_K_M) and installs it automatically on first launch. Intended for non-technical users on a normal internet-connected machine who don't want to find and sideload a model themselves. Installs side by side with the standard build (separate app identifier), and behaves identically once a model is loaded — you can still add or switch to other models afterward.

### From source

```bash
git clone https://github.com/Ayoub-EDAHLOULI/Rafeeq.git
cd Rafeeq
npm install
npm run tauri build
```

To build the bundled-starter-model variant yourself: download a `.gguf` model (e.g. Qwen2.5-0.5B-Instruct, Q4_K_M) into a `models-bundle/` folder at the repo root (gitignored, not committed), then run `npm run tauri:build:bundled`.

## Development

```bash
npm install
npm run tauri dev
```

Requires the standard [Tauri prerequisites](https://tauri.app/start/prerequisites/) (Rust toolchain, platform-specific webview dependencies) plus CMake, a C/C++ compiler (MSVC on Windows), and LLVM/libclang for `bindgen` — all needed to compile `llama.cpp` from source via `llama-cpp-sys-2` at build time. On Windows, set `LIBCLANG_PATH` if `bindgen` can't find `libclang.dll` automatically.

## Project status

Core milestones complete, built incrementally:

- [x] Project scaffolding
- [x] Model manager + basic local chat
- [x] Offline/air-gap verification tooling
- [x] Code-help mode
- [x] Document Q&A + summarization
- [x] Local RAG (stretch)
- [x] Session history (stretch)
- [x] Multi-model profiles (stretch)

First release (0.1.0, Windows) published. Next up: OCR for scanned PDFs, and macOS/Linux release builds.

## License

MIT — see [LICENSE](LICENSE).

Base model weights are distributed separately under their own licenses (see [Getting a model](#getting-a-model)); Rafeeq does not bundle or redistribute model weights.

## Author

**Ayoub Edahlouli**
Full-stack software engineer · [ayoubedahlouli.com](https://ayoubedahlouli.com) · [@Ayoub-EDAHLOULI](https://github.com/Ayoub-EDAHLOULI)
