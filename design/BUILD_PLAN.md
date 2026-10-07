# Rafeeq redesign — build plan

Status: approved, with amendments (see §5). Steps are checked off below as they land.

## Step status

- [x] Step 1 — Design tokens and Tailwind mapping
- [x] Step 2 — Bundle fonts locally (+ Arabic fallback stack, `dir="auto"`)
- [ ] Step 3 — App shell: rail, top bar, status bar
- [ ] Step 4a — RAM/CPU status command (system-wide, visibility-gated polling)
- [ ] Step 4b — Model type detection and caching
- [ ] Step 5 — Models page and First run
- [ ] Step 6 — Chat: sidebar grouping, loaded-model pill, mode tabs restyle
- [ ] Step 7 — Session panel (system prompt, temperature, context length)
- [ ] Step 8 — Document panel: context meter (real tokenizer count) and extracted-text preview
- [ ] Step 9 — Settings page (local JSON store, path TBD at implementation time)
- [ ] Step 10 — Knowledge base: folder list and status model
- [ ] Step 11a — Background indexing with progress events
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

### Step 3 — App shell: rail, top bar, status bar [MVP]
**Goal:** Introduce section-based navigation (Chat / Models / Settings, with Knowledge gated behind the RAG milestone flag) replacing the current binary `App.tsx` switch. Add the icon rail and a real status bar.
**Files:** `src/App.tsx` (rewritten), new `src/components/Rail.tsx`, `src/components/StatusBar.tsx`, `src/components/TopBar.tsx` (absorbs/replaces `AppHeader.tsx`).
**Approach:** No router library — four sections is small enough for a `useState<Section>` in `App.tsx`, consistent with "prefer none" on dependencies. Status bar ships with just the offline indicator in this step; RAM/CPU land in their own step (4b) since they need a new Rust command.
**Acceptance criteria:** Can navigate Chat ↔ Models ↔ Settings (Settings page is a placeholder stub in this step) via the rail. Loaded-model pill in top bar shows "No model loaded" or the current model, opens nothing yet (wired in step 5).
**Verify:** Click all three rail icons, confirm correct section renders, confirm offline pill and theme toggle still work, confirm no console errors in either model-loaded or no-model-loaded state.
**Risk:** Medium — this is the biggest structural change. Mitigate by keeping `ModelManager` and `ChatView` internals untouched in this step; only their mounting point changes.
**Commit message:** `Add section navigation shell with icon rail and status bar`

### Step 4a — RAM/CPU status command [MVP]
**Goal:** New Rust command returning system-wide RAM used/total and CPU %, polled by the status bar only while the window is visible/focused.
**Files:** `src-tauri/src/system_stats.rs` (new), `src-tauri/Cargo.toml` (new dependency), `src-tauri/src/lib.rs`, `src/lib/systemStats.ts` (new), `src/components/StatusBar.tsx`.
**Approach:** See decision D3 — use `sysinfo` crate, poll every 2s from the frontend via `setInterval`, gated by the Page Visibility API (`document.visibilityState`) so polling stops when the window is minimized or in the background, and restarts on focus. Reads system-wide RAM used/total (matching the design's "RAM 1.4 / 8 GB" framing — total machine memory, not just this process) and system-wide CPU %, not a Rust-side push loop.
**Acceptance criteria:** Status bar shows live system RAM (used/total) and CPU %, values change plausibly during generation vs idle, and polling visibly stops (no network/CPU activity from this feature) when the window is minimized.
**Verify:** Load a model, send a message, watch CPU% rise during generation and RAM stay roughly stable; confirm no visible stutter in token streaming while polling runs; minimize the window and confirm (via a log or breakpoint) polling pauses, then resumes on restore.
**Risk:** Low. `sysinfo` is a well-established, pure-Rust, no-network crate.
**Commit message:** `Add live system RAM and CPU readings to the status bar`

### Step 4b — Model type detection and caching [MVP]
**Goal:** Add `type: "chat" | "embedding" | "unknown"` to `ModelInfo`, detected via the existing chat-template probe, cached so `scan_models` doesn't reload every model's weights on every call.
**Files:** `src-tauri/src/models.rs`, `src/types/model.ts`.
**Approach:** Probing every `.gguf` file's chat template on every `scan_models` call means loading every model fully just to list them — too slow and memory-heavy with multiple large models present. Cache the result keyed by file path + size + mtime in a small sidecar file (same pattern as `profiles.json`/`sessions/*.json`), invalidated when the file changes. Mark "unknown" until the first successful probe (lazy: probe on first scan after this ships, or probe in the background) rather than blocking first launch.
**Acceptance criteria:** Models list shows a Chat/Embedding badge without a multi-second delay on scan.
**Verify:** With 2+ models present (one chat, one embedding, matching the dev machine's existing `qwen2.5` + `nomic-embed-text` files), confirm badges are correct and `scan_models` stays fast on repeat calls.
**Risk:** Medium — probing requires loading the full model once; on an 8 GB RAM target with a large model already loaded for chat, probing a second large file could spike memory. Mitigate by only probing models under some sane size ceiling automatically, or deferring probing until the user opens the Models page (not on every app launch).
**Commit message:** `Detect and cache model type (chat vs embedding)`

### Step 5 — Models page and First run [MVP]
**Goal:** Restyle `ModelManager` into the new Models-page layout (list + details panel), restyle the empty state into the First-run layout.
**Files:** `src/components/ModelManager.tsx` (rewritten), `src/components/ModelCard.tsx` (restyled), new `src/components/ModelDetailsPanel.tsx`, new `src/components/FirstRun.tsx` (extracted from the empty-state branch).
**Approach:** Keep all existing data flow (`scanModels`, `loadModel`, profiles) — this step is layout and visual, using the type badge from step 4b. "Models to start with" cards are static copy only, no in-app download affordance (see D2).
**Acceptance criteria:** Visually matches `Models.html`/`FirstRun.html` structure (list, details panel on selection, dashed add-model card). All existing actions (load, unload, save/delete profile, open folder, refresh) still work.
**Verify:** With zero models (rename models folder temporarily) confirm First-run layout; restore and confirm Models layout with details panel selection.
**Risk:** Low, mostly visual/structural reshuffling of existing working logic.
**Commit message:** `Restyle Models page and first-run empty state`

### Step 6 — Chat: sidebar grouping, loaded-model pill, mode tabs restyle [MVP]
**Goal:** Visual rework of `ChatView`'s header and `SessionSidebar` into the new layout (Today/Earlier grouping, search, pill-style mode tabs), top-bar loaded-model pill wired to open the model switcher.
**Files:** `src/components/ChatView.tsx`, `src/components/SessionSidebar.tsx`, `src/components/TopBar.tsx`.
**Approach:** Today/Earlier grouping and search are pure client-side list filtering/bucketing over the already-loaded `sessions` array — no new backend needed. Clicking the top-bar pill navigates to the Models section (reuses step 3's navigation) rather than opening a separate dropdown/modal, to avoid building two different "switch model" UIs.
**Acceptance criteria:** Sidebar groups by Today/Earlier, search filters by title, pill shows current model and navigates to Models on click.
**Verify:** With 3+ saved sessions spanning different ages, confirm grouping and search; click the pill and confirm it lands on Models.
**Risk:** Low.
**Commit message:** `Restyle chat sidebar and wire the top-bar model pill`

### Step 7 — Session panel (system prompt, temperature, context length) [MVP]
**Goal:** Add the right-hand session panel in General/Code modes, make temperature, context length, and CPU threads real per-request parameters instead of Rust constants.
**Files:** `src-tauri/src/llm.rs` (accept parameters in `send_message`/`load_model`), `src/lib/scanModels.ts`, `src/components/ChatView.tsx`, new `src/components/SessionPanel.tsx`.
**Approach:** Context length changes require reloading the model's context (`LlamaContextParams::with_n_ctx`), which today only happens in `load_model` — raising or lowering it mid-session means either (a) re-running `load_model` under the hood when the slider changes, or (b) fixing context length at load time and only exposing it as a pre-load setting, not a live slider. Recommend (b): treat context length as a Models-page/load-time choice, not a per-message slider — see decision D8. Temperature is cheap to change per-request (just a sampler parameter), so that part of the design ships as specified.
**Acceptance criteria:** System prompt and temperature are editable and affect the next message sent; context length is shown read-only in this panel (sourced from the loaded model's actual context) unless D8 is resolved otherwise before this step starts.
**Verify:** Change temperature to 0 and 2, send the same prompt twice, confirm visibly different determinism/variety.
**Risk:** Medium — threading a new parameter through `send_message` touches the hottest code path (token generation). Test generation still streams correctly and `Stop` still works after this change.
**Commit message:** `Add session panel with live temperature control`

### Step 8 — Document panel: context meter and extracted-text preview [MVP]
**Goal:** Surface real token usage (counted with the loaded model's own tokenizer, not a heuristic) and the extracted document text in a right-hand panel.
**Files:** `src-tauri/src/documents.rs` (return exact token count alongside content), `src/lib/documents.ts`, `src/components/ChatView.tsx`, new `src/components/DocumentPanel.tsx`.
**Approach:** `pick_document` already tokenizes with the loaded model's tokenizer for truncation — just also return that exact count in `LoadedDocument` rather than adding a second command or estimating. Since this is an exact count from the real tokenizer (not a heuristic like chars/4), the UI shows it as "N / 4,096 tokens" without a "≈" prefix; reserve "≈" for any future count that's genuinely estimated. Drop the design's "1 page" count (not derivable cheaply from plain-text extraction, especially for .txt/.md which have no page concept) — see decision D4.
**Acceptance criteria:** Panel shows "N / 4,096 tokens" (exact) and a scrollable monospace preview of the extracted text.
**Verify:** Load a long document that gets truncated, confirm the meter reflects the truncated count and the truncation warning still shows.
**Risk:** Low.
**Commit message:** `Add document context meter and extracted-text preview`

### Step 9 — Settings page [MVP]
**Goal:** Build the real Settings page: theme (System/Light/Dark), models folder (open + change location), privacy note, history toggle, delete-all, defaults (CPU threads, context length, max response length, temperature), About.
**Files:** new `src-tauri/src/settings.rs`, `src-tauri/src/lib.rs`, new `src/lib/settings.ts`, new `src/components/SettingsPage.tsx`, `src/theme/useTheme.ts` (System option).
**Approach:** One JSON settings file, local-only, stored at `<app_local_data_dir>/settings.json` — the same directory and pattern already used for `profiles.json`, `sessions/*.json`, and `rag_indexes/*.json` (i.e. `resolve_models_dir`'s sibling, via `app.path().app_local_data_dir()`). Loaded once at startup into a small Tauri-managed state, written on change. Nothing here is synced, uploaded, or stored anywhere outside that local per-install directory. "Change models-folder location" is the riskiest item here — see decision D5; recommend shipping "Open folder" + a read-only path in MVP and deferring "change location" to a fast-follow, since moving/relinking a folder that may contain GBs of model weights needs careful UX (copy vs move vs just-point-elsewhere) that's easy to get wrong.
**Acceptance criteria:** Theme System option follows OS changes live; CPU threads/context length/max response/temperature defaults persist across restart and are used as the default when starting a new chat; delete-all removes all session files and the UI reflects it; About shows real version from `tauri.conf.json`.
**Verify:** Set a non-default temperature default, restart the app, start a new chat, confirm the session panel (step 7) shows the new default. Toggle OS theme with System selected, confirm the app follows without restart.
**Risk:** Medium — delete-all is destructive; confirm it's behind a confirmation step (design shows it as a single button with warn color, no confirmation — recommend adding a confirm dialog, since this is exactly the kind of destructive action worth double-checking given no undo exists).
**Commit message:** `Add Settings page with persisted defaults`

---

Everything above is MVP. Everything below is the RAG milestone — it depends on the Knowledge page's status model existing, so it must ship in this order.

### Step 10 — Knowledge base: folder list and status model [RAG milestone]
**Goal:** Replace the single-shot "index a folder" flow with a persisted list of folders, each with a status (Not indexed / Indexing / Indexed), independent of whether indexing has run.
**Files:** `src-tauri/src/rag.rs` (data model change: a "folder entry" persists even with zero chunks), `src/lib/rag.ts`, new `src/components/KnowledgePage.tsx`.
**Approach:** Add a folder can be added without indexing immediately (picker adds a "Not indexed" entry; "Index now" triggers the existing embed flow). This is a genuine behavior change from today's "pick folder → index immediately" — flag this to the user as a confirmed scope increase, not just a restyle.
**Acceptance criteria:** Can add a folder, see it as "Not indexed", trigger indexing separately, see it become "Indexed" with file/chunk counts.
**Verify:** Add a folder, confirm it shows Not indexed with no chunks; click Index now; confirm status updates without a page reload.
**Risk:** Medium — changes the on-disk index format (adds folders with zero chunks), needs a migration path for indexes created under the old flow (likely trivial: old indexes already have chunks, so they just become "Indexed" on first load).
**Commit message:** `Add Knowledge base page with per-folder indexing status`

### Step 11a — Background indexing with progress events [RAG milestone]
**Goal:** Move indexing off the blocking command path onto a background thread that emits per-file progress events, matching the `chat-token`/`chat-done` event pattern already used for generation.
**Files:** `src-tauri/src/rag.rs` (move `pick_and_index_folder`'s body to a background thread, emit `index-progress`/`index-done`/`index-error` events), `src/lib/rag.ts`, `src/components/KnowledgePage.tsx`.
**Approach:** Limit indexing to a small fixed number of worker threads (e.g. 1–2, not one-per-file), both to respect the 8 GB RAM / CPU-only target and so indexing doesn't starve a concurrent chat generation of CPU. The embedding model's `Mutex` (already shared with `rag_search`) means indexing and search already serialize correctly by construction — the new risk is only that a long-running background thread holds that lock in smaller increments (per-chunk, not per-folder) so `rag_search` from an active chat isn't blocked for the whole indexing run.
**Acceptance criteria:** Indexing a folder with many files shows a live progress bar and file counter, driven by real events, not a simulated/optimistic UI. The app stays responsive (chat still usable, RAG search against a different already-indexed folder still works) while indexing runs.
**Verify:** Index a folder with 20+ small files, confirm the progress bar advances in step with actual embedding work; while indexing runs, send a chat message using a different, already-indexed folder, confirm it still responds promptly.
**Risk:** Medium-high — this is the most invasive Rust change in the plan, since it moves a currently-synchronous command onto a background thread with event-driven progress, all while the embedding model's `Mutex` is also used by `rag_search`. Needs careful, fine-grained locking so a chat's RAG search doesn't stall behind an in-progress index for longer than a single chunk's embedding time.
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

## 4. Summary of risk areas across the whole plan

- Steps 11a/11b (non-blocking indexing with progress, then pause/cancel) are the single riskiest pair of steps — background threading plus a shared `Mutex` with `rag_search` needs careful, fine-grained-lock testing to avoid stalling a concurrent chat.
- Step 7 and step 9 both touch the hot inference path (`send_message`) to add configurable parameters — regression-test token streaming and Stop after each.
- D5 (change models-folder location) is deliberately deferred rather than guessed at, since getting it wrong risks user data loss.
