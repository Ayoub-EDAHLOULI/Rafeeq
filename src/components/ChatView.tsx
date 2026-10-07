import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ChatMessage } from "../types/message";
import {
  getContextSize,
  sendMessage,
  stopGeneration,
  unloadModel,
  type ChatTurn,
} from "../lib/scanModels";
import { pickDocument, type LoadedDocument } from "../lib/documents";
import {
  deleteSession,
  listSessions,
  loadSession,
  saveSession,
  type SessionSummary,
} from "../lib/sessions";
import { ragSearch, type RagResult } from "../lib/rag";
import { getSettings } from "../lib/settings";
import MessageContent from "./MessageContent";
import SessionSidebar from "./SessionSidebar";
import SessionPanel from "./SessionPanel";
import DocumentPanel from "./DocumentPanel";
import RagPanel from "./RagPanel";
import SourcesPanel from "./SourcesPanel";

type ChatMode = "general" | "code" | "document" | "rag";

const DEFAULT_SYSTEM_PROMPT =
  "You are Rafeeq, a concise and helpful assistant that runs fully offline.";

const CODE_HELP_SYSTEM_PROMPT =
  "You are a code assistant. Explain code, answer programming questions, " +
  "and suggest fixes or improvements clearly and concisely. Use fenced " +
  "code blocks for any code you write. You cannot execute code or access " +
  "files — only discuss and explain it.";

const NO_FABRICATION_RULE =
  "Only state facts, numbers, names, and dates that appear explicitly in " +
  "the provided text. Do not calculate, infer, combine, or introduce any " +
  "number that is not written in the source. If a question asks for " +
  "something not directly stated, say it isn't in the document rather " +
  "than estimating or guessing.";

function documentSystemPrompt(doc: LoadedDocument): string {
  return (
    "You are answering questions about the following document. Base your " +
    "answers only on its content; say so if the answer isn't in it. " +
    NO_FABRICATION_RULE +
    `\n\n--- ${doc.file_name} ---\n${doc.content}`
  );
}

function ragSystemPrompt(results: RagResult[]): string {
  if (results.length === 0) {
    return (
      "No relevant passages were found in the indexed folder for this " +
      "question. Say so rather than guessing."
    );
  }
  const passages = results
    .map((r) => `[${r.source_file}]\n${r.text}`)
    .join("\n\n---\n\n");
  return (
    "Answer the question using only the passages below, retrieved from a " +
    "local document index. Cite the source file when relevant, and say " +
    "so if the passages don't contain the answer. " +
    NO_FABRICATION_RULE +
    "\n\n" +
    passages
  );
}

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
  const [loadedDoc, setLoadedDoc] = useState<LoadedDocument | null>(null);
  const [isPickingDocument, setIsPickingDocument] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCreatedAt, setSessionCreatedAt] = useState<number | null>(null);
  const [pendingSessionModel, setPendingSessionModel] = useState<string | null>(
    null,
  );
  const [ragIndexId, setRagIndexId] = useState<string | null>(null);
  const [ragResults, setRagResults] = useState<RagResult[] | null>(null);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [temperature, setTemperature] = useState(0.8);
  const [maxResponseTokens, setMaxResponseTokens] = useState<
    number | undefined
  >(undefined);
  const [passagesPerQuestion, setPassagesPerQuestion] = useState(5);
  const [contextSize, setContextSize] = useState<number | null>(null);
  const activeRequestId = useRef<string | null>(null);

  useEffect(() => {
    getContextSize()
      .then(setContextSize)
      .catch(() => {});
    getSettings()
      .then((settings) => {
        setTemperature(settings.default_temperature);
        setMaxResponseTokens(settings.max_response_tokens);
        setPassagesPerQuestion(settings.passages_per_question);
      })
      .catch(() => {});
  }, []);

  const sessionStateRef = useRef({
    messages,
    sessionId,
    sessionCreatedAt,
    mode,
  });
  sessionStateRef.current = { messages, sessionId, sessionCreatedAt, mode };

  function refreshSessions() {
    listSessions()
      .then(setSessions)
      .catch(() => {});
  }

  useEffect(() => {
    refreshSessions();
  }, []);

  function persistSession() {
    const { messages, sessionId, sessionCreatedAt, mode } =
      sessionStateRef.current;
    if (messages.length === 0) return;

    const id = sessionId ?? crypto.randomUUID();
    const createdAt = sessionCreatedAt ?? Date.now();
    const firstUserMessage = messages.find((m) => m.role === "user");
    const title = firstUserMessage
      ? firstUserMessage.content.slice(0, 60)
      : "New chat";

    if (!sessionId) {
      setSessionId(id);
      setSessionCreatedAt(createdAt);
    }

    saveSession(id, title, mode, modelName, messages, createdAt)
      .then(refreshSessions)
      .catch(() => {});
  }

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
      persistSession();
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

    let turnSystemPrompt: string | null =
      mode === "general"
        ? systemPrompt
        : mode === "code"
          ? CODE_HELP_SYSTEM_PROMPT
          : mode === "document" && loadedDoc
            ? documentSystemPrompt(loadedDoc)
            : null;

    if (mode === "rag" && ragIndexId) {
      try {
        const results = await ragSearch(ragIndexId, prompt, passagesPerQuestion);
        setRagResults(results);
        turnSystemPrompt = ragSystemPrompt(results);
      } catch (err) {
        setError(String(err));
        return;
      }
    }

    const requestId = crypto.randomUUID();
    activeRequestId.current = requestId;

    const history: ChatTurn[] = [
      ...(turnSystemPrompt
        ? [{ role: "system" as const, content: turnSystemPrompt }]
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
      await sendMessage(requestId, history, temperature, maxResponseTokens);
    } catch (err) {
      activeRequestId.current = null;
      setIsGenerating(false);
      setError(String(err));
    }
  }

  function handleNewChat() {
    setMessages([]);
    setSessionId(null);
    setSessionCreatedAt(null);
    setLoadedDoc(null);
    setRagResults(null);
    setError(null);
  }

  async function handleSelectSession(id: string) {
    setError(null);
    try {
      const session = await loadSession(id);
      if (session.model_file !== modelName) {
        setPendingSessionModel(session.model_file);
        return;
      }
      setMessages(session.messages);
      setSessionId(session.id);
      setSessionCreatedAt(session.created_at);
      setMode(session.mode as ChatMode);
      setLoadedDoc(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      await deleteSession(id);
      if (id === sessionId) handleNewChat();
      refreshSessions();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleLoadDocument() {
    setError(null);
    setIsPickingDocument(true);
    try {
      const doc = await pickDocument();
      if (doc) setLoadedDoc(doc);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsPickingDocument(false);
    }
  }

  async function handleStop() {
    try {
      await stopGeneration();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleUnload() {
    try {
      await unloadModel();
      onChangeModel();
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
    <div className="flex h-full">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={sessionId}
        onSelect={handleSelectSession}
        onDelete={handleDeleteSession}
        onNewChat={handleNewChat}
      />
      <div className="mx-auto flex h-full min-w-0 max-w-3xl flex-1 flex-col px-6 py-6">
        {pendingSessionModel && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
            <p className="text-text">
              That chat used{" "}
              <span className="font-mono text-xs">{pendingSessionModel}</span>.
              Load it to resume this chat.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingSessionModel(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-inputBg"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={onChangeModel}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Switch model
              </button>
            </div>
          </div>
        )}
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-border pb-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">Chat</p>
            <p className="truncate font-mono text-xs text-subText">
              {modelName}
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Chat mode"
            className="flex shrink-0 gap-0.5 rounded-xl border border-border bg-card p-0.5"
          >
            {(
              [
                { key: "general", label: "General" },
                { key: "code", label: "Code help" },
                { key: "document", label: "Document" },
                { key: "rag", label: "RAG" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={mode === tab.key}
                onClick={() => setMode(tab.key)}
                className={`h-9 rounded-lg px-4 text-sm font-medium transition-colors ${
                  mode === tab.key
                    ? "bg-primary text-white"
                    : "text-subText hover:text-text"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "document" && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <button
              type="button"
              onClick={handleLoadDocument}
              disabled={isPickingDocument}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-inputBg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPickingDocument
                ? "Choosing…"
                : loadedDoc
                  ? "Change document"
                  : "Load document"}
            </button>
            {loadedDoc ? (
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-text">
                  {loadedDoc.file_name}
                </p>
                {loadedDoc.truncated && (
                  <p className="text-xs text-danger">
                    Document was too long and was truncated to fit the model's
                    context.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-subText">
                No document loaded. Supports .txt, .md, .docx, and .pdf files.
              </p>
            )}
          </div>
        )}

        {mode === "rag" && (
          <RagPanel activeIndexId={ragIndexId} onSelectIndex={setRagIndexId} />
        )}

        <div className="flex-1 overflow-y-auto pr-3">
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
                    dir="auto"
                    className={`max-w-[75%] rounded-xl px-4 py-2 text-sm ${
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
            dir="auto"
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
              disabled={
                !input.trim() ||
                (mode === "document" && !loadedDoc) ||
                (mode === "rag" && !ragIndexId)
              }
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
      </div>

      {mode === "general" && (
        <SessionPanel
          systemPrompt={systemPrompt}
          onSystemPromptChange={setSystemPrompt}
          temperature={temperature}
          onTemperatureChange={setTemperature}
          contextSize={contextSize}
          modelName={modelName}
          onUnload={handleUnload}
        />
      )}

      {mode === "document" && <DocumentPanel doc={loadedDoc} />}

      {mode === "rag" && <SourcesPanel results={ragResults} />}
    </div>
  );
}
