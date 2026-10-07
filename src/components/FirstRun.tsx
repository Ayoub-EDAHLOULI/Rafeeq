interface FirstRunProps {
  modelsDir: string;
  onOpenModelsDir: () => void;
  onRefresh: () => void;
}

function CopyPathButton({ path }: { path: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      // Clipboard access can fail (e.g. no permission); nothing to recover.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy folder path"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-subText transition-colors hover:bg-inputBg hover:text-text"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect
          x="9"
          y="9"
          width="11"
          height="11"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path
          d="M5 15V6a2 2 0 0 1 2-2h8"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

const STARTER_MODELS = [
  {
    name: "Qwen2.5 0.5B Instruct",
    description: "Quickest way to test that everything works.",
    size: "469 MB",
    license: "Apache 2.0",
  },
  {
    name: "Phi-4-mini-instruct",
    description:
      "Better answers for chat, code and documents. Plan for 8 GB of RAM or more.",
    size: "≈ 2.3 GB",
    license: "MIT",
  },
];

export default function FirstRun({
  modelsDir,
  onOpenModelsDir,
  onRefresh,
}: FirstRunProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7 px-6 py-10">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-text">
          Add a model to get started
        </h1>
        <p className="mt-2.5 max-w-xl text-base leading-relaxed text-subText">
          Rafeeq runs language models from files on this device. It does not
          include one and never downloads one for you, so nothing ever
          leaves this machine.
        </p>
      </div>

      <div className="flex flex-wrap gap-3.5">
        {[
          {
            step: "1",
            title: "Download a GGUF file",
            body: (
              <>
                On a computer with internet, search Hugging Face for a model
                with <span className="font-mono text-xs">GGUF</span> in the
                name (e.g. "Qwen2.5-0.5B-Instruct-GGUF" for a small, fast
                option).
              </>
            ),
          },
          {
            step: "2",
            title: "Copy it to this computer",
            body: "Use a USB drive or an internal file share, then put the file in the models folder shown below.",
          },
          {
            step: "3",
            title: "Refresh",
            body: "Rafeeq finds the file and lists it under Models. Nothing is uploaded or checked online.",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="flex min-w-[240px] flex-1 flex-col gap-2.5 rounded-xl border border-border bg-card p-5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-panel2 font-mono text-sm font-medium text-accentFg">
              {item.step}
            </div>
            <div className="text-base font-semibold text-text">
              {item.title}
            </div>
            <div className="leading-relaxed text-subText">{item.body}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card py-3.5 pl-4 pr-3.5">
        <div className="min-w-[300px] flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Models folder
          </div>
          <div className="mt-1.5 break-all font-mono text-sm text-text">
            {modelsDir}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <CopyPathButton path={modelsDir} />
          <button
            type="button"
            onClick={onOpenModelsDir}
            className="h-11 rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-inputBg"
          >
            Open models folder
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="h-11 rounded-lg bg-primary px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          Models to start with
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {STARTER_MODELS.map((model, i) => (
            <div
              key={model.name}
              className={`flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5 ${
                i < STARTER_MODELS.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="min-w-[220px] flex-1">
                <div className="font-semibold text-text">{model.name}</div>
                <div className="mt-0.5 text-subText">{model.description}</div>
              </div>
              <span className="font-mono text-sm text-subText">
                {model.size}
              </span>
              <span className="font-mono text-sm text-subText">
                {model.license}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
