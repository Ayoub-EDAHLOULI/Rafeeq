# Rafeeq redesign — build plan

Status: approved, with amendments (see §5). Steps are checked off below as they land.

## Step status

- [x] Step 1 — Design tokens and Tailwind mapping
- [x] Step 2 — Bundle fonts locally (+ Arabic fallback stack, `dir="auto"`)
- [x] Step 3 — App shell: rail, top bar, status bar
- [x] Step 4a — RAM/CPU status command (system-wide, visibility-gated polling)
- [x] Step 4b — Model type detection and caching
- [x] Step 5 — Models page and First run
- [x] Step 6 — Chat: sidebar grouping, loaded-model pill, mode tabs restyle
- [x] Step 7 — Session panel (system prompt, temperature, context length)
- [x] Step 8 — Document panel: context meter (real tokenizer count) and extracted-text preview
- [x] Step 9 — Settings page (local JSON store: `<app_local_data_dir>/settings.json`)
- [x] Step 10 — Knowledge base: folder list and status model
- [x] Step 11a — Background indexing with progress events
- [ ] Step 11b — Pause/cancel, thread-limited indexing
- [ ] Step 12 — Knowledge indexing settings panel
- [ ] Step 13 — RAG tab restyle with folder filter pills
- [ ] Step 14 — RAG no-match state and relevance threshold

## 0. Corrections to design/README.md

The README's "what is real" list is mostly right but drifts from the code in a few places. Verified against `src/` and `src-tauri/src/` directly:

- **No rail, no Settings, no Knowledge page, no routing at all.** `App.tsx` is a two-state switch: `ModelManager` or `ChatView`, driven by whether a model is loaded. There is no icon rail, no Settings page, no Knowledge page, and no router. All four need to be built from zero, not restyled.
- **No loaded-model pill / top bar model switcher.** The current header (`AppHeader.tsx`) only has the logo, an `OfflineBadge`, and a theme toggle. "Change model" exists only as a text button inside `ChatView`, which calls `onChangeModel` to fall back to the `ModelManager` screen (not a top-bar pill/dropdown).
- **No session panel.** Temperature (`0.8`), CPU threads, and context size (`CONTEXT_SIZE = 4096`, in `src-tauri/src/llm.rs`) are Rust-side constants today, not wired to any UI, and not per-session.
- **Document context meter is not just a visual gap — there is no token-count API exposed to the frontend at all.** `truncate_to_token_budget` exists in Rust but is only used internally by `pick_document`; nothing returns a live "tokens used" number to React.
- **Model type (Chat vs Embedding) is not detected or stored.** `ModelInfo` (both Rust and TS) has `name`, `file_name`, `size_bytes`, `quant` — no `type` field. The Models screen's "Chat" / "Embedding" badges, and the design's assumption that the Models list can show type up front, require a new field. Today the only way to know a model's type is to try loading it and read the guard error (`load_model` rejects models without a chat template; `load_embedding_model` rejects models with one).
- **RAG indexing is synchronous and single-shot, not the folder-manager the Knowledge screen implies.** `pick_and_index_folder` blocks until every file in the folder is embedded, has no progress events, no pause, and is invoked from inline UI in `RagPanel` (a widget inside the Chat page), not a dedicated page. There is no "Indexing" vs "Indexed" vs "Not indexed" status model — an index either exists on disk or doesn't.
- **RAG has no relevance threshold.** `rag_search` always returns the top `k` chunks by cosine similarity, never zero results on purpose. The `RAGNoMatch` screen requires new retrieval logic, not just a new empty-state component.
- **RAM/CPU in the status bar needs a new dependency.** No system-metrics crate is in `Cargo.toml` today.
- **Fonts: confirmed, the app currently loads none** (`index.html` has no `<link>`, CSS falls back to `Inter, -apple-system, ...`). The design's Google Fonts `<link>` tags in `preview/*.html` must never reach the app; `tauri.conf.json`'s CSP (`font-src 'self' data:`) already blocks a remote font load if one slipped in, which is a useful backstop but not a substitute for bundling fonts properly.
- One thing the README undersells: offline auditing (`offline_audit.rs`), profiles, docx/pdf extraction, and the fabrication-guard system prompts are more mature than the design assumes — the design doesn't show profiles at all. Decide where profiles live in the new nav (see open decision D7).

## 1. Gap analysis per screen

Legend: **(a)** visual only, **(b)** new frontend state/logic, **(c)** new Rust/Tauri command or storage.

### Main (Chat, General mode)
| Design element | Exists today? | Kind |
|---|---|---|
| Top bar, rail, offline pill, theme toggle | Header exists, no rail | (a) rail is new layout, not visual-only — it needs active-section state |
| Loaded-model pill in top bar | No | (b) new state (which section/model is active) + (a) styling |
| Chat sidebar (New chat, search, grouped sessions) | Sessions exist (`SessionSidebar`), no search, no Today/Earlier grouping | (a) grouping/search UI; (b) search needs client-side filtering (cheap, sessions are already in memory) |
| Mode segmented control (General/Code/Document/RAG) | Exists in `ChatView`, different visual style | (a) |
| Chat bubbles, composer, "Generated on this device" | Exists, different visual style | (a) |
| Session panel (system prompt, temperature, context length, unload) | Does not exist | (b) new per-session state; (c) temperature/context-length/CPU-threads must become request parameters instead of Rust constants |

### Models
| Design element | Exists today? | Kind |
|---|---|---|
| Model list with Load/Unload, pin/favorite | List + Load/Unload exist (`ModelCard`); "favorite" exists as profiles, different UX (name + save, not a pin) | (a) restyle; (b) decide if "pin" replaces or sits beside profiles (see D7) |
| Type badge (Chat/Embedding) | Not stored anywhere | (c) new field on `ModelInfo`, computed via the same chat-template probe already used by the load guards, cached so it doesn't require loading the model twice |
| Details side panel (quant, size, file, location) | Data exists (`ModelInfo` + `models_dir`), no panel | (a) + (b) selection state |
| "Add another model" dashed card | `ModelManager`'s empty state has similar copy, but only shown when zero models exist, not as a persistent card | (a) |
| Profile pills row | Exists, different placement/style | (a) |

### Document Q&A
| Design element | Exists today? | Kind |
|---|---|---|
| Document chip with page count, "Change document" | File name + truncation warning exist; no page count | (a); page count is not available from `extract_text` today — dropping it or computing a rough estimate is a decision (see D4) |
| Context meter (tokens used / limit, progress bar) | No token count surfaced to frontend | (c) new command or extend `pick_document`'s response to include token count against `CONTEXT_SIZE` |
| Extracted-text preview panel | Not shown anywhere in UI (content is sent to the model but never displayed) | (a) + (b), data already available in `LoadedDocument.content` |
| "Small models can mix up facts" note | No, but `NO_FABRICATION_RULE` system-prompt text covers the same intent | (a) |

### First run
| Design element | Exists today? | Kind |
|---|---|---|
| 3-step sideload guide | Exists almost verbatim in `ModelManager`'s empty state | (a) restyle only |
| Models folder path + copy/open/refresh | Open + Refresh exist; no copy-to-clipboard | (a) + small (b) for clipboard |
| "Models to start with" suggestion cards | Does not exist | (a), static content — must not imply in-app download (see D2) |

### Settings (entirely new page)
| Design element | Exists today? | Kind |
|---|---|---|
| Theme System/Light/Dark | Only Light/Dark toggle exists, no System option, no persistence beyond localStorage key `rafeeq-theme` | (b) add System, which needs a `prefers-color-scheme` listener kept live, not just read once |
| Models folder path + change location | Path readable via `models_dir`; "change location" does not exist | (c) new command to relocate the models directory (symlink vs copy vs just changing a stored path — see D5) |
| Privacy/offline note, history toggle, delete all conversations | Offline note content exists (`offline_audit`); history toggle and delete-all do not | (c) delete-all needs a new command; history toggle needs a new persisted setting |
| CPU threads, context length, max response length, temperature defaults | All are Rust constants today (`CONTEXT_SIZE`, hardcoded sampler values), none configurable, none persisted | (c) new settings storage (file, like sessions/profiles) + wiring into `load_model`/`send_message` |
| About (version, license, built with) | Version is in `tauri.conf.json`/`package.json`, not surfaced to UI | (a) + trivial (b) to read it via `app.package_info()` |

### Knowledge base (entirely new page, RAG milestone)
| Design element | Exists today? | Kind |
|---|---|---|
| Multiple folders with Indexed/Indexing/Not indexed status | One-shot indexing exists; no persisted "not yet indexed" entry, no status enum | (c) new data model: a folder entry must exist independently of whether it has been indexed yet |
| Indexing progress bar, pause | No progress events, indexing is a single blocking call | (c) significant: needs per-file progress events emitted during indexing, and a cancel/pause flag threaded through like `stop_flag` in `llm.rs` |
| Re-index | Delete + re-create exists; no in-place re-index | (c) small, mostly a rename of existing delete+create flow |
| Embedding model picker, chunk size, overlap, passages-per-question | Embedding model picker exists (ad hoc, inside `RagPanel`); chunk size (`CHUNK_TOKENS = 300`) and overlap (`CHUNK_OVERLAP_TOKENS = 50`) are Rust constants | (c) must become configurable parameters, ideally global Settings-backed, not per-index (re-indexing already invalidates on embedding-model change per the design's own copy) |

### RAG (answer with sources)
| Design element | Exists today? | Kind |
|---|---|---|
| Folder filter pills (searching this index, others disabled) | Not applicable yet — today there's one active index selected from a flat list, no index-status-aware disabling | (b) depends on Knowledge page's status model existing first |
| Numbered citations `[1]` inline in the answer | Model is asked to cite via prompt text, not guaranteed, not parsed/rendered as markers | (b) decision needed — see D6 |
| Sources row + passages panel | `ChatView` shows a collapsed `<details>` list of passages, not numbered buttons tied to inline markers | (a) + (b) |

### RAG no-match
| Design element | Exists today? | Kind |
|---|---|---|
| Entire screen | Does not exist. `rag_search` never returns "no match" — it always returns up to `top_k` results regardless of relevance | (c) new: a relevance threshold in `rag_search`, likely a Settings-configurable value (see D6 in the critique section) |
| "Rephrase question" / "Answer without documents" / "Open Knowledge base" actions | None exist | (b) |
| Closest-passages panel (weak matches shown for transparency) | Does not exist | (b), reuses existing retrieval data, just below the new threshold |

## 2. Ordered build plan

Each step is scoped to be one commit and leaves `npm run tauri dev` working. "Verify" always means: run in dev, toggle light/dark via the existing theme toggle, and resize the window toward 1100 px and toward `minWidth: 900`.

### Step 1 — Design tokens and Tailwind mapping [MVP] — DONE
**Goal:** Replace `App.css`'s token names and values with the design's token set, remapped onto the existing Tailwind color keys so no component needs to change yet.
**Files:** `src/App.css`, `tailwind.config.js`, `src/components/ModelCard.tsx`, `src/components/OfflineBadge.tsx`.
**Approach:** Kept the current Tailwind key names (`background`, `card`, `text`, `subText`, `primary`, `danger`, `border`, `inputBg`) and added the missing ones the design needs (`panel2`, `faint`, `accentFg`, `onAccent`, `dot`, `warn`) rather than renaming existing keys. Swapped hex values to match `TOKENS.md`, with two deliberate exceptions (see `design/README.md`'s "Deviations from the mockups"): `danger` keeps its existing red rather than adopting the design's orange `--warn` (added as its own separate token, reserved for the Settings delete-all button in step 9); `.dark` class-based theming (not `[data-theme]`) is kept, since that's how `useTheme.ts` already toggles themes. The 3 existing uses of `primary` as a text color (`ModelCard.tsx` ×2, `OfflineBadge.tsx` ×1 — all the `bg-primary/10 text-primary` badge pattern) were switched to `accentFg`, per `TOKENS.md`'s rule to use accent-as-text only via `accentFg`. Grepped all of `src/` for hardcoded hex/rgb outside token definitions: none found — `App.css`'s token block is the only place color literals exist.
**Acceptance criteria:** App still runs unchanged visually apart from exact color shifts. `npx tsc --noEmit` clean.
**Verify:** Open the app, toggle theme, confirm colors shifted and nothing crashed or lost contrast. Check the "Loaded" badge on a loaded model card and the Offline badge — both now use the slightly lighter `accentFg` blue for text instead of the base `primary`, which should look correct, not broken, on both themes.
**Risk:** Low.
**Commit message:** `Apply redesign color tokens`

### Step 2 — Bundle fonts locally, with Arabic fallback [MVP] — DONE
**Goal:** Add Hanken Grotesk and JetBrains Mono as local font files, apply them via CSS `@font-face`, remove any possibility of a network font request. Add an Arabic-capable fallback stack and `dir="auto"` on message text, since neither Hanken Grotesk nor JetBrains Mono cover Arabic glyphs.
**Files:** `package.json` (3 new dependencies), `src/App.css`, `tailwind.config.js` (fontFamily), `src/components/ChatView.tsx` (`dir="auto"` on the message bubble and composer textarea).
**Approach:** Used `@fontsource/hanken-grotesk`, `@fontsource/jetbrains-mono`, `@fontsource/noto-sans-arabic` (all 5.3.0, all OFL-licensed) — confirmed each ships real static `.woff2`/`.woff` files in its npm tarball (not a runtime loader), with per-weight-per-subset CSS files. Imported only the latin-subset, 3-weight files actually needed (`latin-400/500/600.css` for Hanken Grotesk, `latin-400/500.css` for JetBrains Mono, `arabic-400/500/600.css` for Noto Sans Arabic) rather than each package's full `index.css`, to avoid bundling unused Cyrillic/Greek/Vietnamese subsets. `font-family` stack is `"Hanken Grotesk", "Noto Sans Arabic", system-ui, sans-serif` for `sans` and `"JetBrains Mono", "Noto Sans Arabic", monospace` for `mono`, wired via Tailwind's `fontFamily.sans`/`fontFamily.mono` so the existing `font-mono` utility classes (already used in 5 components for file names/paths) pick it up automatically — no per-component font changes needed beyond that. `dir="auto"` was added to the chat message bubble wrapper in `ChatView.tsx` (not `MessageContent.tsx`, which has no wrapping element of its own) and to the composer `<textarea>`, so both sent/received messages and text being typed lay out RTL correctly per-message.
**Verified:** `npm run check-offline` passes (its plugin-based check is unaffected by font packages, as expected). `npx tsc --noEmit` clean. `npm run build` output confirmed: all 8 font files (`.woff2`+`.woff` × 4 weights) land in `dist/assets/` with content-hashed names; `grep`ing the built CSS and HTML for `https?://` found zero matches; the built `@font-face` rules reference local `/assets/...` paths, not `node_modules` or any external URL.
**Remaining manual verification (for you):** disconnect network, run `npm run tauri dev`, confirm the app renders in the new typeface. Paste or send a message containing Arabic text and confirm it renders right-to-left and legibly (not boxes) — I can't drive the live Tauri window myself, so this one's worth a quick hands-on check before moving on.
**Risk:** Medium — font licensing and file size, both resolved cleanly (all three fonts OFL-licensed; the 3-weight-only latin/arabic-subset imports keep the added bundle size to ~310 KB across woff+woff2, well under the installer's existing footprint).
**Commit message:** `Bundle Hanken Grotesk, JetBrains Mono, and an Arabic fallback locally`

### Step 3 — App shell: rail, top bar, status bar [MVP] — DONE
**Goal:** Introduce section-based navigation (Chat / Models / Settings, with Knowledge gated behind the RAG milestone flag) replacing the current binary `App.tsx` switch. Add the icon rail and a real status bar.
**Files:** `src/App.tsx` (rewritten), new `src/components/Rail.tsx`, `src/components/StatusBar.tsx`, `src/components/TopBar.tsx`, new `src/components/SettingsPage.tsx` (placeholder stub), removed `src/components/AppHeader.tsx` (superseded by `TopBar.tsx`, nothing else referenced it).
**Approach:** No router library — three sections (`"chat" | "models" | "settings"`) via a `useState<Section>` in `App.tsx`, consistent with "prefer none" on dependencies. Status bar ships with just the offline indicator this step (copied from the old `OfflineBadge` logic, styled as the design's status-bar row); RAM/CPU land in step 4a. The top-bar loaded-model pill shows the loaded filename (or "No model loaded" with a hollow dot) and navigates to Models on click — it doesn't yet show quant/size, since that detail only exists on `ModelInfo` records fetched by `ModelManager`, not the plain filename string `App.tsx` tracks; richer pill content is deferred to step 6, as the plan already specified. When no model is loaded, the Chat rail icon still shows `ModelManager` (not an empty chat view), since chatting needs a loaded model — this matches First-run intent rather than being a bug.
**Acceptance criteria:** Can navigate Chat ↔ Models ↔ Settings via the rail. Settings page is a placeholder stub. Loaded-model pill in top bar shows "No model loaded" or the current model's filename, clicking it navigates to Models.
**Verified:** `npx tsc --noEmit` clean, `npm run build` succeeds with no new warnings.
**Remaining manual verification (for you):** `npm run tauri dev`, click all three rail icons and confirm correct section renders each time; confirm the offline badge and theme toggle still work in the top bar; confirm no console errors with a model loaded and with none loaded; click the model pill and confirm it switches to the Models section.
**Risk:** Medium — this is the biggest structural change so far. Mitigated by keeping `ModelManager` and `ChatView` internals completely untouched; only their mounting point in `App.tsx` changed.
**Commit message:** `Add section navigation shell with icon rail and status bar`

### Step 4a — RAM/CPU status command [MVP] — DONE
**Goal:** New Rust command returning system-wide RAM used/total and CPU %, polled by the status bar only while the window is visible/focused.
**Files:** `src-tauri/src/system_stats.rs` (new), `src-tauri/Cargo.toml` (added `sysinfo = "0.39.6"`), `src-tauri/src/lib.rs`, `src/lib/systemStats.ts` (new), `src/components/StatusBar.tsx`.
**Approach:** See decision D3 — `sysinfo` crate's `System` is held in Tauri-managed state (`SystemStatsState`, a `Mutex<System>`) across calls rather than recreated per-call, since `sysinfo` computes CPU usage as a delta between refreshes — a fresh `System`'s first reading would be meaningless. The frontend's 2s poll interval is well past `sysinfo`'s documented 200ms minimum refresh spacing, so no artificial delay was needed in the command itself. Polling uses `setInterval` gated by `document.visibilitychange`/`document.visibilityState`, starting on mount if visible and stopping/restarting as visibility changes, with cleanup on unmount. Reads system-wide `used_memory()`/`total_memory()` (bytes) and `global_cpu_usage()` (aggregate %), not per-process figures, matching the design's "RAM 1.4 / 8 GB" framing.
**Verified:** `cargo check` and `cargo build` both clean. `npx tsc --noEmit` clean. `npm run check-offline` still passes (sysinfo is a local-syscall crate, not a network-capable Tauri plugin, so correctly doesn't trip the check). `npm run build` succeeds.
**Remaining manual verification (for you):** `npm run tauri dev`, confirm the status bar shows live RAM used/total and CPU% that update every ~2s. Load a model and send a message, watch CPU% rise during generation. Minimize the window, wait a few seconds, then restore it and confirm the numbers resume updating (rather than having drifted/frozen) — this is the one behavior I can't verify without driving the live window myself.
**Risk:** Low. `sysinfo` is a well-established, pure-Rust, no-network crate.
**Commit message:** `Add live system RAM and CPU readings to the status bar`

### Step 4b — Model type detection and caching [MVP] — DONE
**Goal:** Add `type: "chat" | "embedding" | "unknown"` to `ModelInfo`, detected via the existing chat-template probe, cached so `scan_models` doesn't reload every model's weights on every call.
**Files:** `src-tauri/src/models.rs`, `src-tauri/src/llm.rs` (added a `backend()` accessor so `scan_models` can reuse the shared `Arc<LlamaBackend>` without a second `LlamaBackend::init()`), `src/types/model.ts`, `src/lib/scanModels.ts`.
**Approach:** Probing uses `LlamaModelParams::with_vocab_only(true)` rather than a normal load — this turned out to fully solve the risk flagged below, not just mitigate it: `vocab_only` makes llama.cpp read only the vocabulary and GGUF metadata (chat templates are stored as metadata, not derived from tensor data, so `chat_template()` still works), without allocating any tensor weights. Probing cost no longer scales with model size at all, so there's no need for a size ceiling or deferred-probing workaround. Results are cached in a single `model_type_cache.json` map file (one file, not one-per-model like `profiles.json`, since this is a derived cache rather than user data) at the app's local data root, keyed by filename with a `{size_bytes, modified_millis}` cache key — a changed file (different size or mtime) is treated as uncached and re-probed automatically.
**Verified:** `cargo check`/`cargo build` clean, `npx tsc --noEmit` clean. Confirmed end-to-end against the real dev-machine models: `model_type_cache.json` was generated correctly during a live `tauri dev` run, correctly classifying `qwen2.5-0.5b-instruct-q4_k_m.gguf` as `"chat"` and `nomic-embed-text-v1.5.Q4_K_M.gguf` as `"embedding"`, with cache keys matching the files' real on-disk size and mtime exactly (verified by comparing the cached `modified_millis` against each file's actual modify timestamp in milliseconds).
**Acceptance criteria:** Met — the cache correctly reflects model type for both files present, and the `vocab_only` probe approach means `scan_models` stays fast regardless of how large a probed file is.
**Risk:** Was medium (probing could spike memory with a large model already loaded) — resolved by `vocab_only`, which doesn't load tensor weights at all, so this risk no longer applies. Remaining risk is low: `vocab_only` is a well-established llama.cpp loading mode, already exposed by the `llama-cpp-2` bindings this project already depends on.
**Commit message:** `Detect and cache model type (chat vs embedding)`

### Step 5 — Models page and First run [MVP] — DONE
**Goal:** Restyle `ModelManager` into the new Models-page layout (list + details panel), restyle the empty state into the First-run layout.
**Files:** `src/components/ModelManager.tsx` (rewritten), `src/components/ModelCard.tsx` (restyled, now selectable, shows the step 4b type badge), new `src/components/ModelDetailsPanel.tsx`, new `src/components/FirstRun.tsx` (extracted from the old empty-state branch).
**Approach:** Kept all existing data flow (`scanModels`, `loadModel`, profiles) untouched — this step is layout and selection state only. `ModelCard` is now clickable to select it for the details panel, with Load/Unload/Save-profile buttons calling `stopPropagation()` so clicking them doesn't also change the selection. Selection persists across `Refresh` when the previously-selected file is still present, otherwise falls back to the loaded model, then the first model in the list. The details panel shows the model's type (from step 4b's `modelType` field) along with quant/size/file/location, plus a short note that differs for embedding vs. chat models. "Models to start with" cards are static copy only, no in-app download affordance (per D2). The folder-path copy button uses the plain `navigator.clipboard` Web API rather than adding `@tauri-apps/plugin-clipboard-manager`, avoiding a new dependency for one button.
**Verified:** `npx tsc --noEmit` clean. `npm run build` succeeds; spot-checked the built CSS to confirm non-default-looking utility classes used here (`bg-dot`, `bg-panel2`, `text-faint`, `gap-2.5`/`gap-3.5`) actually compiled to real rules rather than being silently dropped by Tailwind's content scanning.
**Remaining manual verification (for you):** `npm run tauri dev`. With zero models (temporarily rename the models folder) confirm the First-run layout renders. Restore it and confirm the Models list, details panel on selection (click a card, not its buttons), and the type badges read correctly for your `qwen2.5` (Chat) and `nomic-embed-text` (Embedding) files. Confirm load/unload, save/delete profile, open folder, and refresh all still work as before.
**Risk:** Low — mostly visual/structural reshuffling of already-working logic; the only new logic is the selection state and its fallback rules.
**Commit message:** `Restyle Models page and first-run empty state`

### Step 6 — Chat: sidebar grouping, loaded-model pill, mode tabs restyle [MVP] — DONE
**Goal:** Visual rework of `ChatView`'s header and `SessionSidebar` into the new layout (Today/Earlier grouping, search, pill-style mode tabs), top-bar loaded-model pill wired to open the model switcher.
**Files:** `src/components/ChatView.tsx` (mode tabs restyled into a pill-style `role="tablist"`; the separate "Change model" button removed, since the top-bar pill already does this and the design avoids two controls for the same action), `src/components/SessionSidebar.tsx` (rewritten with Today/Earlier grouping and a search input).
**Approach:** Today/Earlier grouping and search are pure client-side filtering/bucketing (`useMemo` over the already-loaded `sessions` array, "Today" = same calendar day as now) — no new backend needed. `TopBar.tsx` needed no changes: its loaded-model pill was already wired to navigate to the Models section back in step 3, satisfying this step's pill requirement ahead of time.
**Verified:** `npx tsc --noEmit` clean, `npm run build` succeeds.
**Remaining manual verification (for you):** `npm run tauri dev`. With 3+ saved chats spanning different ages (today vs. older), confirm the sidebar groups them under "Today" and "Earlier" correctly, and that typing in the search box filters by title (case-insensitive) with an empty-match message when nothing matches. Switch between the four mode tabs and confirm the pill-style active state matches the mockup. Click the top-bar model pill and confirm it still navigates to Models (unchanged since step 3, but worth re-checking after this restyle).
**Risk:** Low.
**Commit message:** `Restyle chat sidebar and chat mode tabs`

### Step 7 — Session panel (system prompt, temperature, context length) [MVP] — DONE
**Goal:** Add the right-hand session panel in General mode, make temperature a real per-request parameter instead of a Rust constant, and show context length read-only per D8.
**Files:** `src-tauri/src/llm.rs` (`send_message` now takes `temperature: Option<f32>`, threaded into `generate()`'s `LlamaSampler::temp`; new `context_size` command exposing the existing `CONTEXT_SIZE` constant), `src-tauri/src/lib.rs` (registers `context_size`), `src/lib/scanModels.ts` (`sendMessage` takes `temperature`, new `getContextSize`), `src/components/ChatView.tsx`, new `src/components/SessionPanel.tsx`.
**Approach:** Per D8, context length is shown read-only (fetched once via the new `context_size` command, not a live slider) rather than reloading the model's context mid-session. Temperature is a genuine live per-request parameter — cheap to change since it's just a sampler argument, no model/context reload needed; confirmed `LlamaSampler::temp(0.0)` is safe (passes straight to llama.cpp's `llama_sampler_init_temp`, which treats `t <= 0` as standard greedy/argmax sampling, not a divide-by-zero). The panel is shown only in General mode — Code/Document/RAG modes already inject their own fixed or retrieval-driven system prompts, so a freely-editable "system prompt" box would be ambiguous there. System prompt defaults to the mockup's text ("You are Rafeeq, a concise and helpful assistant that runs fully offline."), editable, applied only when `mode === "general"`. The panel also repeats the loaded-model name and an Unload button (calling the existing `unload_model` command, then `onChangeModel()` to return to the model switcher), matching the mockup.
**Verified:** `cargo check`/`cargo build` clean with no warnings. `npx tsc --noEmit` clean. `npm run build` succeeds.
**Remaining manual verification (for you):** `npm run tauri dev`, switch to General mode and confirm the session panel appears with the system prompt, temperature slider, read-only context length, loaded-model name, and Unload button. Edit the system prompt and confirm it's used (e.g. ask the model to state its instructions). Set temperature to 0, send the same prompt twice, confirm near-identical output both times (greedy); set it to 2, send it twice more, confirm more variation. Confirm `Stop` still works mid-generation (this step touched the hot generation path). Click Unload and confirm it returns to the Models/model-switcher view.
**Risk:** Was medium (threading a new parameter through the hottest code path) — mitigated by keeping the change additive (`Option<f32>` with a default) and confirmed via a clean full `cargo build`; still worth the manual streaming/Stop re-check above since this is exactly the kind of change that can silently break under real generation load even when it compiles.
**Commit message:** `Add session panel with live temperature control`

### Step 8 — Document panel: context meter and extracted-text preview [MVP] — DONE
**Goal:** Surface real token usage (counted with the loaded model's own tokenizer, not a heuristic) and the extracted document text in a right-hand panel.
**Files:** `src-tauri/src/documents.rs` (`LoadedDocument` now includes `token_count` and `context_size`), `src-tauri/src/llm.rs` (`truncate_to_token_budget`/`truncate_to_budget` now also return the resulting exact token count — the original count if untruncated, otherwise exactly `budget` — reusing the tokenization already done for truncation rather than tokenizing twice), `src/lib/documents.ts`, `src/components/ChatView.tsx`, new `src/components/DocumentPanel.tsx`.
**Approach:** No new command — `pick_document` already tokenizes with the loaded model's tokenizer for truncation, so the exact count comes along for free. Since this is an exact count from the real tokenizer (not a heuristic like chars/4), the UI shows it as "N / 4,096 tokens" without a "≈" prefix, per the earlier amendment. Dropped the design's "1 page" count (not derivable cheaply from plain-text extraction, especially for .txt/.md which have no page concept) — see decision D4. The panel is shown whenever `mode === "document"` and a document is loaded, alongside the existing document chip (unchanged).
**Verified:** `cargo check`/`cargo build` clean, no warnings. `npx tsc --noEmit` clean. `npm run build` succeeds. Confirmed `truncate_to_token_budget` has exactly one caller (`pick_document`), so the signature change didn't silently leave another call site broken.
**Remaining manual verification (for you):** `npm run tauri dev`, switch to Document mode and load a short document — confirm the panel shows "N / 4,096 tokens" (exact, no "≈") with a progress bar, plus a scrollable monospace preview of the extracted text. Load a long document that gets truncated — confirm the token count shown equals the truncation budget and the existing "truncated" warning in the document chip still appears.
**Risk:** Low.
**Commit message:** `Add document context meter and extracted-text preview`

### Step 9 — Settings page [MVP] — DONE
**Goal:** Build the real Settings page: theme (System/Light/Dark), models folder (open, read-only path per D5), privacy note, history toggle, delete-all, defaults (CPU threads, context length read-only, max response length, temperature), About.
**Files:** new `src-tauri/src/settings.rs` (get/save settings, delete-all-sessions, app-version commands), `src-tauri/src/llm.rs` (`load_model` takes `cpu_threads: Option<u32>` applied via `with_n_threads`/`with_n_threads_batch`; `send_message` takes `max_response_tokens: Option<usize>`; renamed the generation-length and temperature constants to `pub DEFAULT_*` so `settings.rs` can reuse them as fallback defaults instead of duplicating the numbers), `src-tauri/src/sessions.rs` (`resolve_sessions_dir` made `pub` so settings' delete-all can reuse it), `src-tauri/src/lib.rs`, new `src/lib/settings.ts`, `src/components/SettingsPage.tsx` (full rewrite), `src/theme/useTheme.ts` (rewritten with a `ThemePreference` separate from the resolved `theme`, so System mode can track `prefers-color-scheme` live via a `matchMedia` change listener, not just a one-time read), `src/App.tsx` (passes theme preference through), `src/components/ChatView.tsx` (loads settings once per chat view to seed temperature/max-response-tokens, still editable live via the session panel), `src/components/ModelManager.tsx` (both `loadModel` call sites now fetch settings first and pass `cpu_threads` through).
**Approach:** One JSON settings file, local-only, at `<app_local_data_dir>/settings.json` — same directory and pattern as `profiles.json`/`sessions/*.json`/`rag_indexes/*.json`. Delete-all uses an inline "click again to confirm" button (turns into a confirm/cancel pair for a few seconds) rather than a modal, matching the app's existing lightweight style, since this is exactly the kind of destructive, no-undo action worth a deliberate second step. CPU threads turned out to need the same load-time treatment as context length (both only apply via `LlamaContextParams` at `load_model` time, not live), confirmed via `llama-cpp-2`'s `with_n_threads`/`with_n_threads_batch`. "Change models-folder location" is deferred per D5 — ships as Open folder + read-only path only.
**Verified:** `cargo check`/`cargo build` clean, no warnings. `npx tsc --noEmit` clean. `npm run build` succeeds.
**Remaining manual verification (for you):** `npm run tauri dev`. Set a non-default temperature/max-response-length/CPU-threads in Settings, restart the app, start a new General chat, and confirm the session panel shows the new temperature default (CPU threads takes effect on the next model load, not retroactively on an already-loaded model — reload the model to confirm it applied). With System theme selected, change your OS's light/dark setting and confirm the app follows without restarting. Click "Delete all conversations" once (should ask you to confirm), confirm it, and check the chat sidebar is empty afterward.
**Risk:** Medium — this was the largest step so far, touching settings storage, theme resolution, and two load-time generation parameters at once. Mitigated by keeping every new backend parameter `Option<T>` with an unchanged default, so existing behavior is preserved when settings haven't loaded yet or a caller omits them.
**Commit message:** `Add Settings page with persisted defaults`

---

Everything above is MVP. Everything below is the RAG milestone — it depends on the Knowledge page's status model existing, so it must ship in this order.

### Step 10 — Knowledge base: folder list and status model [RAG milestone] — DONE
**Goal:** Replace the single-shot "index a folder" flow with a persisted list of folders, each with a status (Not indexed / Indexing / Indexed), independent of whether indexing has run.
**Files:** `src-tauri/src/rag.rs` (`RagIndex` gains a `status` field; `pick_and_index_folder` split into `add_folder` — picks a folder, creates a `NotIndexed` entry, no embedding model required yet — and `index_folder` — embeds an already-added folder's files, reusing the prior embed logic unchanged), `src-tauri/src/lib.rs`, `src/lib/rag.ts` (`addFolder`/`indexFolder`, `RagIndexSummary.status`), `src/components/RagPanel.tsx` (minimal compatibility update: its existing one-click "index folder" button now calls `addFolder` then `indexFolder` in sequence, preserving its current UX — full restyle to read the status model is step 13), `src/components/Rail.tsx` (adds the Knowledge-base rail icon, previously gated behind this milestone), `src/App.tsx` (routes the new `"knowledge"` section — needed explicit handling, since the existing `section === "models" || !activeModel` branch would otherwise have swallowed a no-model-loaded visit to Knowledge), new `src/components/KnowledgePage.tsx`.
**Approach:** Migration handled via `#[serde(default)]` rather than an explicit migration pass: deserializing an old-format index file (no `status` key) yields `status: None`, and a `resolved_status()` helper infers `Indexed` if it already has chunks, `NotIndexed` otherwise — so old indexes become correct under the new model the first time they're read, with no separate migration code path to get wrong. Folder naming currently uses a native `window.prompt()` (no modal component exists anywhere in this codebase yet to build one from) — acceptable for this step since it's about the data model and status display, not polishing the add-folder UX.
**Verified:** `cargo check`/`cargo build` clean, no warnings. `npx tsc --noEmit` clean. `npm run build` succeeds. Confirmed the real migration case directly: inspected the existing `rag_indexes/*.json` file from earlier manual testing (24 chunks, no `status` key — genuinely old-format data, not synthetic) to confirm the deserialization path the migration relies on actually matches that file's shape.
**Remaining manual verification (for you):** restart `npm run tauri dev` (this step changes the Rust binary, so a running dev instance needs a fresh start to pick it up — same as previous backend-touching steps). Open Knowledge base and confirm your existing indexed folder shows status "Indexed" with its real chunk count, not reset to Not indexed. Add a new folder, confirm it appears as "Not indexed" with no chunk count; click "Index now" and confirm it updates to "Indexed" with a chunk count, without a page reload. Confirm RAG mode in Chat still works end-to-end (pick/index a folder via `RagPanel`, ask a question against it).
**Risk:** Medium, as flagged — the on-disk format change was the main risk, mitigated by the `#[serde(default)]` migration approach confirmed against real data above.
**Commit message:** `Add Knowledge base page with per-folder indexing status`

### Step 11a — Background indexing with progress events [RAG milestone] — DONE
**Goal:** Move indexing off the blocking command path onto a background thread that emits per-file progress events, matching the `chat-token`/`chat-done` event pattern already used for generation.
**Files:** `src-tauri/src/rag.rs` (`index_folder` now spawns a `std::thread` and returns immediately; new `run_indexing` helper emits `rag-index-progress`/`rag-index-done`/`rag-index-error`), `src/lib/rag.ts` (`indexFolder` returns `Promise<void>`, new event payload types), `src/components/KnowledgePage.tsx` (listens for the three events, shows a live per-folder progress bar), `src/components/RagPanel.tsx` (updated to the new async/event flow instead of assuming a synchronous summary return — its UI itself is still unrestyled, as planned; that's step 13).
**Approach:** Used a single background thread (not a small pool) — embedding is CPU-bound and already parallelizes internally via `LlamaContextParams`' own thread count, so multiple OS threads contending for the same `RagState` mutex and the same CPU cores would add complexity without real throughput gain. The real fix for the flagged risk was locking `state.loaded` **per file**, not once for the whole run: the lock is acquired and dropped inside an explicit `{ }` block for each file's embedding work, so `rag_search` from an active chat is blocked for at most one file's embedding time, never the whole indexing job. (Caught a real bug here during review: an initial `drop(loaded)` call after the per-file work was a no-op, since `loaded` was the dereferenced `&mut LoadedEmbeddingModel`, not the `MutexGuard` — the explicit block scope is what actually releases the lock.) On failure, the folder's status reverts to `NotIndexed` (not left stuck on "Indexing") and any partial chunks from the failed run are discarded rather than saved half-finished.
**Verified:** `cargo check`/`cargo build` clean, no warnings — including after fixing the no-op `drop()` the compiler flagged. `npx tsc --noEmit` clean, `npm run build` succeeds. Confirmed via `grep` that all four places `RagState.loaded` is locked anywhere in the file are now short-lived (load/swap, read, per-file embed, single-query search) — no remaining code path holds the mutex for a whole multi-file run.
**Remaining manual verification (for you):** restart `npm run tauri dev` (Rust binary changed). Index a folder with several files from Knowledge base and confirm a live progress bar/file counter advances in step with real embedding work, not a fake animation. While that's running, switch to Chat → RAG mode and ask a question against a *different*, already-indexed folder — confirm it still answers promptly rather than hanging behind the indexing job. Confirm a failed index (e.g. point at a folder with no supported files) leaves the folder back at "Not indexed" rather than stuck on "Indexing".
**Risk:** Was medium-high, as flagged — the fine-grained per-file locking (not just per-chunk, which would've been more invasive for similar benefit) is the mitigation; the compiler itself caught one locking bug during implementation, which is a good sign the lock-scoping is now something the type system can reason about rather than something resting on careful-but-unenforced convention.
**Commit message:** `Make folder indexing run in the background with progress events`

### Step 11b — Pause/cancel, thread-limited indexing [RAG milestone]
**Goal:** Add a pause/cancel flag to the background indexing job from 11a, following the `stop_flag`/`AtomicBool` pattern already used for chat generation in `llm.rs`.
**Files:** `src-tauri/src/rag.rs` (cancellation flag, resumable/discardable partial state), `src/lib/rag.ts`, `src/components/KnowledgePage.tsx`.
**Approach:** Built as a separate step from 11a deliberately — progress events and cancellation are two independently-testable pieces of a risky change, and splitting them keeps each commit small and bisectable if something regresses.
**Acceptance criteria:** Pause stops further embedding without losing already-embedded chunks; indexing can resume from where it left off or be discarded entirely.
**Verify:** Start indexing a folder with 20+ files, click Pause partway through, confirm the chunks embedded so far are retained and the status reflects a paused state (not silently stuck or lost); resume and confirm it continues rather than restarting from zero.
**Risk:** Medium — mostly state-management risk (ensuring a paused job's partial chunks are neither duplicated on resume nor lost on discard).
**Commit message:** `Add pause and cancel to background folder indexing`

### Step 12 — Knowledge indexing settings panel [RAG milestone]
**Goal:** Expose embedding model, chunk size, overlap, and passages-per-question as configurable settings (global, from step 9's settings store), shown in the Knowledge page's right panel.
**Files:** `src-tauri/src/rag.rs` (`CHUNK_TOKENS`/`CHUNK_OVERLAP_TOKENS` become parameters), `src-tauri/src/settings.rs`, `src/components/KnowledgePage.tsx`.
**Acceptance criteria:** Changing chunk size/overlap only affects future indexing runs (existing indexes keep their original chunking until re-indexed, matching the design's own "changing it means re-indexing" copy).
**Verify:** Change chunk size, re-index an existing folder, confirm new chunk count differs from before.
**Risk:** Low, mostly plumbing once steps 11a/11b land.
**Commit message:** `Make chunk size, overlap, and passage count configurable`

### Step 13 — RAG tab restyle with folder filter pills [RAG milestone]
**Goal:** Restyle the RAG mode's inline panel into folder filter pills (reflecting each index's status from step 10) and the sources/passages right panel.
**Files:** `src/components/ChatView.tsx`, `src/components/RagPanel.tsx` (rewritten), new `src/components/SourcesPanel.tsx`.
**Acceptance criteria:** Pills show each known folder with its status; disabled pills for not-yet-indexed folders match the design.
**Risk:** Low, visual/structural once step 10's status model exists.
**Commit message:** `Restyle RAG tab with folder filter pills and sources panel`

### Step 14 — RAG no-match state and relevance threshold [RAG milestone]
**Goal:** Add a minimum relevance score to `rag_search`; below it, return no answer and instead show the closest (weak-match) passages.
**Files:** `src-tauri/src/rag.rs` (threshold logic), `src/lib/rag.ts`, `src/components/ChatView.tsx`, new `src/components/RagNoMatch.tsx`.
**Approach:** See decision D6. Threshold is a configurable Settings value (default needs tuning — start conservative, expect this number to move after real-world testing with the actual embedding model in use, since cosine-similarity score distributions vary by embedding model).
**Acceptance criteria:** A question clearly unrelated to indexed content shows the no-match screen with weak-match passages, not a fabricated answer. A clearly-related question still answers normally.
**Verify:** Ask an on-topic and an off-topic question against the same index, confirm the two different UI states trigger correctly. Test the threshold isn't so aggressive that legitimate close questions get rejected.
**Risk:** Medium — threshold tuning is inherently fuzzy; ship it adjustable in Settings so it isn't a hardcoded guess.
**Commit message:** `Add RAG relevance threshold and no-match state`

## 3. Decisions needed, with recommendations

**D1 — Font packaging.** Recommend `@fontsource/hanken-grotesk` and `@fontsource/jetbrains-mono` (npm packages that ship the actual font files, imported at build time, bundled by Vite into `dist/assets/`). Confirmed pattern: these packages contain static files, not a runtime font-loader, so nothing is fetched at app runtime. Only pull the weights actually used (400/500/600 sans, 400/500 mono) to keep the installer small. This is one new dependency category (two packages) — flagging per the "don't add dependencies without telling me why" rule.

**D2 — Bundled-installer first run.** The bundled build already auto-copies its `.gguf` into the user's models folder on first launch (`install_bundled_model_if_needed`), so by the time the UI renders, the models folder is non-empty and First-run never shows — this already works correctly and needs no change. Recommend explicitly not adding a bundled-build-specific first-run message ("a model came with this install") unless you want one; it's a nice-to-have, not required.

**D3 — RAM/CPU cost. DECIDED:** `sysinfo` crate, refreshed on a 2s frontend-driven poll (`invoke` call in a `setInterval`), showing system-wide RAM used/total and system-wide CPU% (not just this process's RSS, so the number matches what the design's "RAM 1.4 / 8 GB" framing implies — total machine memory pressure, which is what matters for an 8 GB RAM target). Polling is gated by the Page Visibility API so it stops while the window isn't visible, avoiding any background cost when Rafeeq isn't in focus. This is cheap (a handful of `/proc` reads on Linux, equivalent syscalls elsewhere) and doesn't touch the inference thread, so it won't hurt generation speed. Reading *per-core* breakdown or anything fancier is unnecessary for a one-line status bar and would cost more without benefit.

**D4 — Page count on Document screen.** Recommend dropping it. There's no cheap, accurate way to compute "pages" from extracted plain text (page count is a rendering concept, not a text concept, and especially meaningless for .txt/.md). Replace with something real and cheap instead: character or word count, which costs nothing extra to compute.

**D5 — Change models-folder location.** Recommend deferring to a fast-follow after MVP. Moving a folder that may hold multiple GB of model weights needs a decision on copy-vs-move, what happens if the move fails partway, and whether the old location should be cleaned up — none of that is in the design spec, and guessing wrong here risks data loss (large downloaded files the user may not want to re-sideload). Ship "Open folder" (already exists) and the read-only path in MVP; scope "change location" separately once the UX for a multi-GB move is actually decided.

**D6 — Source citations: app-attached vs model-generated. DECIDED:** citations come from the app; no inline `[n]` markers are parsed from or relied on in model output. Attach citations programmatically after retrieval, not relying on the model to emit `[1]`/`[2]` markers correctly. The model free-texting citation markers is exactly the kind of thing a 0.5B-class local model will get wrong (wrong number, missing marker, hallucinated marker pointing at a source it didn't use) — and the project already has a documented problem with small-model fabrication (see `NO_FABRICATION_RULE` in `ChatView.tsx`, added after real user-testing fallout). The Sources panel and passages list don't need the model to self-report anything: the app already knows exactly which passages were retrieved and sent, so it can render "Sources" as simply the full list of passages that were included in the prompt, without needing inline `[n]` markers at all. This sidesteps the reliability problem entirely rather than trying to parse and validate model-generated markers. The no-match threshold (step 14 / D14) is the same principle extended: a decision made from retrieval scores, not from asking the model whether it found an answer.

**D7 — Where do profiles fit in the new nav?** Not addressed by the design at all. Recommend keeping profiles as-is (pills row on the Models page, as today) rather than trying to map them onto the design's "pin as favorite" icon button, since profiles save a *named shortcut to load a specific model*, while the design's pin/favorite reads as a simple boolean. These are different features; don't conflate them silently. Flag for explicit confirmation before step 5.

**D8 — Context length: live slider or load-time setting?** The design shows it as a live slider in the session panel (4096, range 512–8192). The current architecture only sets context size at model-load time (`LlamaContextParams::with_n_ctx`, inside `load_model`). Making it live would mean silently reloading the model (multi-second operation, user-visible stall) whenever the slider moves. Recommend treating context length as a Models-page/Settings-page setting that takes effect on next load, with the session panel showing it read-only ("4096, set when the model was loaded") rather than as a live-dragging slider. Flag for confirmation before step 7.

**D9 — Minimum window width behavior below ~1100px.** Not designed, per the README's own admission. Recommend: right-hand panels (session/document/sources) collapse behind a toggle button in the top bar below ~1100px, rather than wrapping below the chat column (wrapping would push the composer off-screen in a 900px-wide window, which is the app's actual documented minimum). This needs a small amount of new responsive layout work in each page that has a right panel (steps 6, 8, 13) — budget time for it there rather than treating it as a separate step. **Amendment:** also set an explicit minimum window size in `src-tauri/tauri.conf.json` matching this layout's real floor. The current `minWidth: 900, minHeight: 600` was chosen before this redesign; it should be re-checked against the shell's actual minimum usable width (rail 64px + sidebar/content/panel at their smallest collapsed states) once step 3's shell exists, and tightened or loosened as needed — likely done as part of step 3 or step 9 rather than a separate step, since it's a one-line config change validated by the same manual resize test already used throughout this plan.

**Out-of-plan fix (after step 5, on user feedback from a live screenshot):** default window size bumped from 1180×760 to 1280×800 (closer to the 1440×800 the mockups are designed at) and minimum from 900×600 to 1000×640, in `src-tauri/tauri.conf.json`. Base font size reduced from the browser default 16px to 14px via `html { font-size: 87.5% }` in `src/App.css`, matching the design's documented 14px body size (`TOKENS.md`) — the live app was reading visibly larger than the mockups since nothing had set this yet. This scales every `rem`-based Tailwind class proportionally rather than needing per-component size changes. Window later set to open centered (`"center": true`) and height reverted to 760px on further feedback.

**Out-of-plan fixes (after step 9, on user feedback):** Settings page's `max-w-4xl` cap removed so its two-column layout fills the available content width instead of leaving dead space on wide windows. Added a "Developer" row to the About section linking to the developer's portfolio (`https://ayoubedahlouli.com`), which required adding `@tauri-apps/plugin-opener` (the standard Tauri 2 plugin for opening URLs in the OS default browser, since the webview's CSP blocks plain `<a href>` navigation to external origins) — one new dependency, flagged per the "tell me why" rule. First attempt granted only `opener:allow-open-url`, which enables the command but with an empty URL scope by default, so clicks silently did nothing; fixed by also granting `opener:allow-default-urls`, which pre-configures the scope for `http(s)`/`mailto`/`tel` URLs. Both fixes required restarting the dev process (not just a frontend hot-reload) since they touch the compiled Rust binary and its capability permissions.

## 4. Summary of risk areas across the whole plan

- Steps 11a/11b (non-blocking indexing with progress, then pause/cancel) are the single riskiest pair of steps — background threading plus a shared `Mutex` with `rag_search` needs careful, fine-grained-lock testing to avoid stalling a concurrent chat.
- Step 7 and step 9 both touch the hot inference path (`send_message`) to add configurable parameters — regression-test token streaming and Stop after each.
- D5 (change models-folder location) is deliberately deferred rather than guessed at, since getting it wrong risks user data loss.
