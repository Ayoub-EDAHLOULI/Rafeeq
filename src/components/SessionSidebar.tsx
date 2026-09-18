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

export default function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onNewChat,
}: SessionSidebarProps) {
  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border">
      <div className="p-3">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-inputBg"
        >
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-4 text-xs text-subText">No saved chats yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-left transition-colors ${
                  session.id === activeSessionId
                    ? "bg-inputBg"
                    : "hover:bg-inputBg"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
