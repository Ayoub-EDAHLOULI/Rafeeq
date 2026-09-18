import type { ModelInfo } from "../types/model";
import { formatBytes } from "../lib/formatBytes";

interface ModelCardProps {
  model: ModelInfo;
  isLoaded: boolean;
  isLoading: boolean;
  onLoad: (model: ModelInfo) => void;
  onUnload: (model: ModelInfo) => void;
}

export default function ModelCard({
  model,
  isLoaded,
  isLoading,
  onLoad,
  onUnload,
}: ModelCardProps) {
  return (
    <div
      className={`group flex items-center gap-4 rounded-xl border bg-card px-5 py-4 transition-colors ${
        isLoaded ? "border-primary/60" : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="3"
            y="4"
            width="18"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M7 9h10M7 13h6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium leading-tight text-text">
            {model.name}
          </p>
          {isLoaded && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Loaded
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-subText">
          {model.fileName}
        </p>
      </div>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {model.quant && (
          <span className="rounded-full bg-inputBg px-2.5 py-1 text-xs font-medium text-subText">
            {model.quant}
          </span>
        )}
        <span className="text-xs tabular-nums text-subText">
          {formatBytes(model.sizeBytes)}
        </span>
      </div>

      {isLoaded ? (
        <button
          type="button"
          onClick={() => onUnload(model)}
          className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-inputBg"
        >
          Unload
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onLoad(model)}
          disabled={isLoading}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Loading…" : "Load"}
        </button>
      )}
    </div>
  );
}
