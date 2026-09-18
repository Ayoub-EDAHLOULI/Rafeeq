import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ChatMessage } from "../types/message";
import { sendMessage, stopGeneration, type ChatTurn } from "../lib/scanModels";
import MessageContent from "./MessageContent";

type ChatMode = "general" | "code";

const CODE_HELP_SYSTEM_PROMPT =
  "You are a code assistant. Explain code, answer programming questions, " +
  "and suggest fixes or improvements clearly and concisely. Use fenced " +
  "code blocks for any code you write. You cannot execute code or access " +
  "files — only discuss and explain it.";

interface ChatViewProps {
  modelName: string;
  onChangeModel: () => void;
}

interface ChatTokenEvent {
  request_id: string;
  token: string;
}

interface ChatDoneEvent {
  request_id: string;
}

interface ChatErrorEvent {
  request_id: string;
  message: string;
}

export default function ChatView({ modelName, onChangeModel }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("general");
  const activeRequestId = useRef<string | null>(null);

  useEffect(() => {
    const unlistenToken = listen<ChatTokenEvent>("chat-token", (event) => {
      if (event.payload.request_id !== activeRequestId.current) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          content: last.content + event.payload.token,
        };
        return updated;
      });
    });

    const unlistenDone = listen<ChatDoneEvent>("chat-done", (event) => {
      if (event.payload.request_id !== activeRequestId.current) return;
      activeRequestId.current = null;
      setIsGenerating(false);
    });

    const unlistenError = listen<ChatErrorEvent>("chat-error", (event) => {
      if (event.payload.request_id !== activeRequestId.current) return;
      activeRequestId.current = null;
      setIsGenerating(false);
      setError(event.payload.message);
    });

    return () => {
      unlistenToken.then((f) => f());
      unlistenDone.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);

  async function handleSend() {
    const prompt = input.trim();
    if (!prompt || isGenerating) return;

    setError(null);
    setInput("");

    const requestId = crypto.randomUUID();
    activeRequestId.current = requestId;

    const history: ChatTurn[] = [
      ...(mode === "code"
        ? [{ role: "system" as const, content: CODE_HELP_SYSTEM_PROMPT }]
        : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: prompt },
    ];

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: prompt },
      { id: requestId, role: "assistant", content: "" },
    ]);
    setIsGenerating(true);

    try {
      await sendMessage(requestId, history);
    } catch (err) {
      activeRequestId.current = null;
      setIsGenerating(false);
      setError(String(err));
    }
  }

  async function handleStop() {
    try {
      await stopGeneration();
    } catch (err) {
      setError(String(err));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-6">
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">Chat</p>
          <p className="truncate font-mono text-xs text-subText">{modelName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center rounded-lg border border-border p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setMode("general")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                mode === "general"
                  ? "bg-primary text-white"
                  : "text-subText hover:text-text"
              }`}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => setMode("code")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                mode === "code"
                  ? "bg-primary text-white"
                  : "text-subText hover:text-text"
              }`}
            >
              Code help
            </button>
          </div>
          <button
            type="button"
            onClick={onChangeModel}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-inputBg"
          >
            Change model
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-subText">
              Ask something to start the conversation.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "bg-card text-text"
                  }`}
                >
                  {message.content.length > 0 ? (
                    <MessageContent content={message.content} />
                  ) : (
                    message.role === "assistant" &&
                    isGenerating && (
                      <span className="text-subText">Thinking…</span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-border pt-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-border bg-inputBg px-3 py-2 text-sm text-text placeholder:text-subText focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {isGenerating ? (
          <button
            type="button"
            onClick={handleStop}
            className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-inputBg"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
