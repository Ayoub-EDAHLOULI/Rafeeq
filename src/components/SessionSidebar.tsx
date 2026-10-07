import { useMemo, useState } from "react";
import type { SessionSummary } from "../lib/sessions";

interface SessionSidebarProps {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
}

function formatRelativeTime(millis: number): string {
  const diffMs = Date.now() - millis;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isToday(millis: number): boolean {
  const d = new Date(millis);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

interface SessionRowProps {
  session: SessionSummary;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function SessionRow({ session, isActive, onSelect, onDelete }: SessionRowProps) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-left transition-colors ${
        isActive ? "bg-inputBg" : "hover:bg-inputBg"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm text-text">{session.title}</p>
        <p className="text-xs text-subText">
          {formatRelativeTime(session.updated_at)}
        </p>
      </button>
      <button
        type="button"
        onClick={() => onDelete(session.id)}
        aria-label="Delete chat"
        className="shrink-0 rounded px-1.5 py-1 text-xs text-subText opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

export default function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onNewChat,
}: SessionSidebarProps) {
  const [query, setQuery] = useState("");

  const { today, earlier } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sessions.filter((s) => s.title.toLowerCase().includes(q))
      : sessions;
    return {
      today: filtered.filter((s) => isToday(s.updated_at)),
      earlier: filtered.filter((s) => !isToday(s.updated_at)),
    };
  }, [sessions, query]);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col gap-3.5 border-r border-border bg-background p-3.5">
      <button
        type="button"
        onClick={onNewChat}
        className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        New chat
      </button>

      <input
        type="search"
        aria-label="Search chats"
        placeholder="Search chats"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-text placeholder:text-subText focus:outline-none focus:ring-1 focus:ring-primary"
      />

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="px-2 py-4 text-xs text-subText">No saved chats yet.</p>
        ) : today.length === 0 && earlier.length === 0 ? (
          <p className="px-2 py-4 text-xs text-subText">No chats match "{query}".</p>
        ) : (
          <div className="flex flex-col gap-3">
            {today.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <span className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Today
                </span>
                {today.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
            {earlier.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <span className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Earlier
                </span>
                {earlier.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
