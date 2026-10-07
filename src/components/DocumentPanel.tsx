import type { LoadedDocument } from "../lib/documents";

interface DocumentPanelProps {
  doc: LoadedDocument | null;
}

export default function DocumentPanel({ doc }: DocumentPanelProps) {
  const percentUsed = doc
    ? Math.min(100, Math.round((doc.token_count / doc.context_size) * 100))
    : 0;

  return (
    <aside
      aria-label="Document context"
      className="flex w-80 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-card px-5 py-5"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        Context
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-text">Context used</span>
          <span className="font-mono text-sm text-subText">
            {doc
              ? `${doc.token_count.toLocaleString()} / ${doc.context_size.toLocaleString()} tokens`
              : "—"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Context used"
          aria-valuemin={0}
          aria-valuemax={doc?.context_size ?? 0}
          aria-valuenow={doc?.token_count ?? 0}
          className="h-2 overflow-hidden rounded-full bg-panel2"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        <p className="text-xs leading-relaxed text-subText">
          The document and the chat share this space. A document that does
          not fit is rejected, not cut off.
        </p>
      </div>

      <div className="h-px bg-border" />

      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="text-sm font-medium text-text">Extracted text</div>
        {doc ? (
          <div
            dir="auto"
            className="flex-1 overflow-y-auto rounded-lg border border-border bg-background px-3.5 py-3 font-mono text-xs leading-relaxed text-subText"
          >
            {doc.content}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-3.5 py-3 text-center text-xs leading-relaxed text-faint">
            Load a document to see its extracted text here.
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background px-3.5 py-3 text-sm leading-relaxed text-subText">
        Small models can mix up facts. Check important numbers against the
        extracted text above.
      </div>
    </aside>
  );
}
