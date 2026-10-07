import type { RagResult } from "../lib/rag";

interface SourcesPanelProps {
  results: RagResult[] | null;
}

export default function SourcesPanel({ results }: SourcesPanelProps) {
  return (
    <aside
      aria-label="Sources"
      className="flex w-80 shrink-0 flex-col gap-3.5 overflow-y-auto border-l border-border bg-card px-5 py-5"
    >
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          Passages used
        </div>
        {results && (
          <span className="font-mono text-xs text-subText">
            {results.length}
          </span>
        )}
      </div>

      {!results || results.length === 0 ? (
        <p className="text-sm leading-relaxed text-subText">
          Ask a question to see which passages the answer was drawn from.
        </p>
      ) : (
        results.map((result, i) => (
          <div
            key={i}
            className="flex flex-col gap-2.5 rounded-xl border border-border bg-background px-4 py-3.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-panel2 font-mono text-[11px] text-accentFg">
                {i + 1}
              </span>
              <span className="min-w-0 truncate font-mono text-xs font-medium text-text">
                {result.source_file}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-subText">
              {result.text}
            </p>
          </div>
        ))
      )}

      <div className="mt-auto rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-relaxed text-subText">
        The model answers from these passages. When it matters, check the
        answer against them.
      </div>
    </aside>
  );
}
