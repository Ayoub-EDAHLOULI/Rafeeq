interface SessionPanelProps {
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  contextSize: number | null;
  modelName: string;
  onUnload: () => void;
}

export default function SessionPanel({
  systemPrompt,
  onSystemPromptChange,
  temperature,
  onTemperatureChange,
  contextSize,
  modelName,
  onUnload,
}: SessionPanelProps) {
  return (
    <aside
      aria-label="Session settings"
      className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-card px-5 py-5"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        Session
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="session-system-prompt" className="text-sm font-medium text-text">
          System prompt
        </label>
        <textarea
          id="session-system-prompt"
          rows={4}
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          className="resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-text focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="session-temperature" className="text-sm font-medium text-text">
            Temperature
          </label>
          <span className="font-mono text-sm text-subText">
            {temperature.toFixed(1)}
          </span>
        </div>
        <input
          id="session-temperature"
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={temperature}
          onChange={(e) => onTemperatureChange(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">Context length</span>
          <span className="font-mono text-sm text-subText">
            {contextSize ?? "—"}
          </span>
        </div>
        <p className="text-xs text-faint">
          Set when the model is loaded. Change it from the Models page.
        </p>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          Loaded model
        </div>
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background px-3.5 py-3">
          <span className="truncate font-mono text-sm text-text">
            {modelName}
          </span>
        </div>
        <button
          type="button"
          onClick={onUnload}
          className="h-11 rounded-lg border border-border text-sm font-medium text-text transition-colors hover:bg-inputBg"
        >
          Unload model
        </button>
      </div>
    </aside>
  );
}
