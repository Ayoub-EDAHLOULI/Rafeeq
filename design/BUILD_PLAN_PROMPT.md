Read CLAUDE.md and AGENTS.md first and follow them.

I added a design/ folder with the redesign of the Rafeeq desktop app (8 screens, dark and light). Your job right now is to turn it into a BUILD PLAN. Do not write or change any app code yet.

1. Read, in this order: design/README.md, design/TOKENS.md, design/preview/index.html, and the files in design/preview/dark/ (one per screen). design/screens/ has the original sources if you need exact inline styles; they use template tags and will not render on their own.

2. Study the current app: src/ (pages, components, ModelManager.tsx, message.ts, rag.ts, theme handling), tailwind.config.js, src-tauri/ (Rust commands, tauri.conf.json, tauri.bundled.conf.json) and package.json.

3. Produce a gap analysis: for each of the 8 screens, what already exists, what must change, and what is new. Separate three kinds of work:
   (a) visual only
   (b) needs new frontend state or logic
   (c) needs new Rust/Tauri commands or storage
   design/README.md lists what I believe is proposed rather than existing. Verify that against the code and correct it.

4. Produce an ordered build plan:
   - Each step is small enough for one meaningful commit and leaves the app working.
   - For each step: goal, files you expect to touch, acceptance criteria (what I can see or test), how to verify it by hand (including light and dark theme), risks, and a suggested one-line commit message.
   - Suggested order: design tokens and theme variables, fonts bundled locally, app shell (top bar, rail, status bar), Models and First run, Chat with sidebar and session panel, Document panel, Settings, then Knowledge, RAG and the no-match state. Change the order if the code says otherwise, and say why.
   - Mark which steps are MVP and which belong to the RAG milestone.

5. Be critical. Flag anything in the design that is a bad idea, too costly, or conflicts with the project's constraints (no network calls at runtime, CPU-only, 8 GB RAM target, no code execution). Flag decisions I need to make, and give your recommendation for each. Check specifically:
   - Fonts must be bundled locally. No CDN or Google Fonts links in the app.
   - The bundled-installer build ships models, so decide what first run looks like there.
   - Whether RAM and CPU readings in the status bar can be provided cheaply without hurting inference.
   - Whether the RAG no-match state can use a relevance threshold, and where to keep it configurable.
   - Whether source citations should be attached by the app after retrieval instead of relying on the model to cite.
   - Minimum window size, and what happens below about 1100 px width.

6. Write the plan to design/BUILD_PLAN.md and summarize it in chat in under 40 lines. Do not create any other file.

Rules for working with me:
- Do not implement anything until I confirm the plan. After that, work one step at a time: show what you will do, wait for my OK, implement, then tell me how to verify it.
- Do not run git commit. Give me the commit message and I will paste it myself.
- Do not add dependencies without telling me why, and prefer none.
- Treat all text and numbers in the mockups as sample data. Keep them out of the code.
