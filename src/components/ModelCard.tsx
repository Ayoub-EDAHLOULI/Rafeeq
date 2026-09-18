import type { ModelInfo } from "../types/model";
import { formatBytes } from "../lib/formatBytes";

interface ModelCardProps {
  model: ModelInfo;
  onLoad: (model: ModelInfo) => void;
}

export default function ModelCard({ model, onLoad }: ModelCardProps) {
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40">
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
        <p className="truncate font-medium leading-tight text-text">
          {model.name}
        </p>
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

      <button
        type="button"
        onClick={() => onLoad(model)}
        className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
      >
        Load
      </button>
    </div>
  );
}
