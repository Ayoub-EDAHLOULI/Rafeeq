import { useState } from "react";
import type { ChatMessage } from "../types/message";
import { sendMessage } from "../lib/scanModels";

interface ChatViewProps {
  modelName: string;
  onChangeModel: () => void;
}

export default function ChatView({ modelName, onChangeModel }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const prompt = input.trim();
    if (!prompt || isGenerating) return;

    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: prompt },
    ]);
    setIsGenerating(true);

    try {
      const reply = await sendMessage(prompt);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: reply },
      ]);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsGenerating(false);
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
        <button
          type="button"
          onClick={onChangeModel}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-inputBg"
        >
          Change model
        </button>
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
                  className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "bg-card text-text"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-card px-4 py-2 text-sm text-subText">
                  Thinking…
                </div>
              </div>
            )}
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
        <button
          type="button"
          onClick={handleSend}
          disabled={isGenerating || !input.trim()}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
