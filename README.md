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
- **Document Q&A** — load a local file (`.txt`, `.md`, `.pdf`, `.docx`) and ask questions about its contents
- **Summarization** — paste or load a document, get a summary

### Planned

- Local RAG over a folder of documents (embeddings + local vector search)
- Conversation history / session management
- Multiple model profiles (fast small model + larger model, user-selectable per session)
- Integration with [Naskh](#) so scanned/OCR'd documents can flow directly into Rafeeq's context

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
- **Disk:** ~20MB for the app, plus the size of whichever model(s) you sideload

## Getting a model

Rafeeq needs at least one `.gguf` model file before it can chat.

1. Download a model — e.g. [`Phi-4-mini-instruct-Q4_K_M.gguf`](https://huggingface.co/microsoft/Phi-4-mini-instruct) from Hugging Face on any machine with internet access
2. Transfer it to the target machine (USB drive, internal file share — whatever your environment allows)
3. Place it in Rafeeq's model directory:
   - **Windows:** `%APPDATA%\rafeeq\models\`
   - **macOS:** `~/Library/Application Support/rafeeq/models/`
   - **Linux:** `~/.local/share/rafeeq/models/`
4. Launch Rafeeq — it will detect the model automatically in the Model Manager

No internet access is required on the target machine at any point after the file is copied.

## Installation

### From release

Download the latest installer for your platform from [Releases](#).

### From source

```bash
git clone https://github.com/Ayoub-EDAHLOULI/rafeeq-desktop.git
cd rafeeq-desktop
npm install
npm run tauri build
```

## Development

```bash
npm install
npm run tauri dev
```

Requires the standard [Tauri prerequisites](https://tauri.app/start/prerequisites/) (Rust toolchain, platform-specific webview dependencies) plus a C/C++ build toolchain and CMake for compiling `llama.cpp` at build time.

## Project status

🚧 Early development. Building incrementally, milestone by milestone:

- [x] Project scaffolding
- [x] Model manager + basic local chat
- [ ] Offline/air-gap verification tooling
- [ ] Code-help mode
- [ ] Document Q&A + summarization
- [ ] Local RAG (stretch)
- [ ] Session history (stretch)
- [ ] Multi-model profiles (stretch)

## License

MIT — see [LICENSE](LICENSE).

Base model weights are distributed separately under their own licenses (see [Getting a model](#getting-a-model)); Rafeeq does not bundle or redistribute model weights.

## Author

**Ayoub Edahlouli**
Full-stack software engineer · [ayoubedahlouli.com](https://ayoubedahlouli.com) · [@Ayoub-EDAHLOULI](https://github.com/Ayoub-EDAHLOULI)
