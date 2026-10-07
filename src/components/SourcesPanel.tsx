import type { RagSearchResult } from "../lib/rag";

interface SourcesPanelProps {
  result: RagSearchResult | null;
}

export default function SourcesPanel({ result }: SourcesPanelProps) {
  const isNoMatch = result !== null && result.used.length === 0;
  const passages = result
    ? result.used.length > 0
      ? result.used
      : result.closest
    : [];

  return (
    <aside
      aria-label={isNoMatch ? "Closest passages" : "Sources"}
      className="flex w-80 shrink-0 flex-col gap-3.5 overflow-y-auto border-l border-border bg-card px-5 py-5"
    >
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          {isNoMatch ? "Closest passages" : "Passages used"}
        </div>
        {result && (
          <span className="font-mono text-xs text-subText">
            {isNoMatch ? "0 used" : passages.length}
          </span>
        )}
      </div>

      {isNoMatch && (
        <p className="text-xs leading-relaxed text-subText">
          These were the nearest matches. None answered the question, so
          none were used.
        </p>
      )}

      {!result || passages.length === 0 ? (
        <p className="text-sm leading-relaxed text-subText">
          Ask a question to see which passages the answer was drawn from.
        </p>
      ) : (
        passages.map((passage, i) => (
          <div
            key={i}
            className={`flex flex-col gap-2.5 rounded-xl border bg-background px-4 py-3.5 ${
              isNoMatch ? "border-dashed border-border" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                {!isNoMatch && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-panel2 font-mono text-[11px] text-accentFg">
                    {i + 1}
                  </span>
                )}
                <span className="min-w-0 truncate font-mono text-xs font-medium text-text">
                  {passage.source_file}
                </span>
              </div>
              {isNoMatch && (
                <span className="shrink-0 rounded-full bg-panel2 px-2.5 py-0.5 text-xs text-subText">
                  Weak match
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-subText">
              {passage.text}
            </p>
          </div>
        ))
      )}

      <div className="mt-auto rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-relaxed text-subText">
        {isNoMatch
          ? "If the answer should be in your files, the folder may need re-indexing, or the document may not be in a searched folder."
          : "The model answers from these passages. When it matters, check the answer against them."}
      </div>
    </aside>
  );
}
