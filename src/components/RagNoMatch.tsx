interface RagNoMatchProps {
  indexName: string;
  onRephrase: () => void;
  onOpenKnowledgeBase: () => void;
  onAnswerWithoutDocuments: () => void;
}

export default function RagNoMatch({
  indexName,
  onRephrase,
  onOpenKnowledgeBase,
  onAnswerWithoutDocuments,
}: RagNoMatchProps) {
  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel2 text-accentFg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="6" />
            <path d="M20 20l-4-4M8.5 11h5" />
          </svg>
        </div>
        <div>
          <div className="text-base font-semibold text-text">
            I couldn't find this in your documents
          </div>
          <p className="mt-1.5 leading-relaxed text-subText">
            Nothing in {indexName} matched your question closely enough. I
            haven't written an answer, because it would be a guess.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRephrase}
          className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Rephrase question
        </button>
        <button
          type="button"
          onClick={onOpenKnowledgeBase}
          className="h-11 rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-inputBg"
        >
          Open Knowledge base
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3.5">
        <button
          type="button"
          onClick={onAnswerWithoutDocuments}
          className="h-11 rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-inputBg"
        >
          Answer without documents
        </button>
        <span className="flex-1 text-xs leading-relaxed text-faint">
          Switches to General chat. The answer will not use your files.
        </span>
      </div>
    </div>
  );
}
