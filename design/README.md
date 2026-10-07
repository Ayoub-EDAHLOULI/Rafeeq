# Rafeeq desktop redesign

Visual designs for the Rafeeq desktop app (Tauri + React + Tailwind), made on a Claude Design canvas. This folder is the reference for rebuilding the UI. It is a design spec, not production code.

Inspired by the layout of local-LLM desktop apps (icon rail, loaded-model pill in the top bar, settings panel beside the chat, status bar), restyled for Rafeeq. Nothing here is copied from another product.

## How to view

- Open `preview/index.html` in a browser, about 1440 px wide. Each screen has a dark and a light version.
- `screens/*.dc.html` are the original canvas sources. They need the canvas runtime to render, so use them only to read exact inline styles. The `preview/` files are the same markup with the template tags resolved.
- `canvas.json` is the canvas layout. You can ignore it when building.
- `TOKENS.md` has the colors, type scale, spacing and sizes.

## Screens

| File | Screen | Maps to |
|---|---|---|
| `Main` | Chat, General mode | Chat page, General tab |
| `Models` | Models list, detail panel, add-a-model card | Models page |
| `Document` | Document Q&A with a context meter and extracted-text panel | Chat page, Document tab |
| `FirstRun` | Empty state with a 3-step sideload guide | Models page when no model exists |
| `Settings` | Appearance, models folder, privacy, defaults | New Settings page |
| `Knowledge` | Indexed folders, embedding model, chunking | New Knowledge base page (RAG milestone) |
| `RAG` | RAG answer with numbered sources and a passages panel | Chat page, RAG tab |
| `RAGNoMatch` | RAG when nothing relevant is found | Chat page, RAG tab |

## Shared layout

- Top bar (60 px): logo, loaded-model pill (opens the model switcher), Offline indicator, theme toggle.
- Icon rail (64 px): Chat, Models, Settings. Knowledge base is a fourth icon that appears when RAG ships. The Documents icon was removed on purpose, because Document is a tab in Chat.
- Chat sidebar (248 to 264 px): New chat, search, conversations grouped by Today and Earlier.
- Right panel (304 to 340 px): session settings, document context, or sources, depending on the screen.
- Status bar (32 px): "Offline · no network calls" on the left, RAM and CPU on the right.
- The main area is fluid. Panels use fixed widths.

## What is real and what is proposed

Read this before planning the build.

Existing in the app today (seen in the current build): model scanning and loading, General / Code help / Document / RAG tabs, chat history, profiles, favorites, light/dark theme, an embedding-model picker, .txt/.md/.docx/.pdf loading, an offline status indicator.

Proposed by the design, so each needs a decision and possibly new backend work:

- Loaded-model pill with unload in the top bar.
- Session panel (system prompt, temperature, context length) on the chat screen.
- Context meter and extracted-text preview on the Document screen.
- The whole Settings page: theme System option, CPU threads, max response length, history toggle, delete all conversations, change models-folder location.
- The whole Knowledge base page: multiple indexed folders, indexing progress and pause, re-index, chunk size, overlap, passages per question.
- RAG source citations and the passages panel. Markers like [1] in the answer text depend on the model following instructions. The panel itself only needs the retrieved passages.
- RAG no-match state. It needs a minimum relevance score in retrieval, tuned on real data.
- Status bar RAM and CPU readings (needs a Rust command).

## Sample data

All names, paths, counts and readings are placeholders: file counts, chunk counts, indexing progress, RAM and CPU values, the "[x.y.z]" version, the question and answer text, and the example documents. Replace them with real data. The model names and file sizes on the Models screen match the current build.

## Things to handle when building

1. Fonts. The canvas loads Hanken Grotesk and JetBrains Mono from Google Fonts. The app must not, because Rafeeq makes no network calls. Bundle the fonts locally (for example the @fontsource packages, confirm the exact package names) and remove any font CDN link.
2. Bundled installer. The repo has a bundled build with models included, so the First run screen only appears when the models folder is empty. Decide how the bundled build should behave on first launch.
3. Window size. Screens are designed at 1440 x 800. Check the layout at the app's minimum window size. The panels wrap below roughly 1100 px, but that has not been designed.
4. Accessibility. Controls are at least 40 to 44 px tall, icon-only buttons have labels, and text colors were chosen for readable contrast in both themes. Keep that when porting.
5. Copy. The wording is a first draft. Keep it plain and short.

## Deviations from the mockups

Decisions made while building that intentionally differ from the mockups, with the reason. See `BUILD_PLAN.md` for the full build plan and the decisions (D1–D9) these come from.

- **Destructive actions stay red, not orange.** `TOKENS.md`'s `--warn` token (orange) is scoped to Settings-only destructive actions in the mockups. The app keeps its existing red for all destructive actions (delete session, delete profile, delete all conversations), since red is the more conventional destructive-action color and nothing requires every destructive button to match. `--warn` is still implemented as a token (for the Settings delete-all button specifically, matching the mockup there) — it's just not used as a blanket replacement for the app's existing danger color.
- **RAM/CPU in the status bar is system-wide, not per-process.** The mockup's "RAM 1.4 / 8 GB" reads as total machine memory pressure against an 8 GB target, not Rafeeq's own memory footprint, so the status bar shows system-wide used/total RAM and system-wide CPU%, not just this process's numbers.
- **Status bar polling pauses when the window isn't visible.** Not shown in the mockups (which are static). Added to avoid any background cost when Rafeeq isn't in focus.
- **No inline `[1]`/`[2]` citation markers parsed from model output.** The mockups show citation markers inline in the answer text. The app attaches citations from the retrieval data directly (the app already knows which passages were sent to the model), rather than asking the model to self-report citations — small local models are an unreliable source for this (see the existing `NO_FABRICATION_RULE` guard in `ChatView.tsx`). The Sources panel still shows the same information, just not as inline markers tied to specific sentences.
- **Context length is a load-time setting, not a live slider.** The mockup's session panel shows a draggable context-length slider. The current architecture only sets context size when a model is loaded; changing it live would require silently reloading the model mid-session. It's shown read-only in the session panel and changed from Models/Settings instead.
- **Document token count has no "≈" prefix.** It's counted with the loaded model's real tokenizer, not estimated, so it's shown as an exact count ("N / 4,096 tokens"). The mockup's "page count" is dropped entirely — it isn't derivable from plain-text extraction, especially for .txt/.md.
- **Arabic text gets a dedicated fallback font and `dir="auto"`.** Neither Hanken Grotesk nor JetBrains Mono cover Arabic glyphs. Not addressed in the mockups, which are English-only samples.
- **"Change models-folder location" is deferred past MVP.** Ships as "Open folder" + read-only path first; moving a folder that may hold several GB of model weights needs a copy-vs-move decision that risks data loss if guessed wrong.
