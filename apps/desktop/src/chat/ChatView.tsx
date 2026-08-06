import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, MessageBubble, MicButton, TypingIndicator, VoiceState } from "@omnira/ui-kit";
import {
  ApiError,
  getActiveCapabilities,
  getConversationMessages,
  isVoiceAvailable,
  listConversations,
  sendChatMessage,
  transcribeAudio,
  type ConversationSummary,
} from "../api-client.js";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder.js";
import { speak } from "../speech.js";
import { ConversationSidebar } from "./ConversationSidebar.js";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const VOICE_MODE_KEY = "omnira.voiceMode";

const STATE_TEXT: Record<VoiceState | "idle", string> = {
  idle: "Hold the core to talk",
  [VoiceState.Listening]: "Listening…",
  [VoiceState.Thinking]: "Thinking…",
  [VoiceState.Speaking]: "Speaking…",
  [VoiceState.AwaitingConfirmation]: "Awaiting confirmation…",
};

export function ChatView(): ReactNode {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micGranted, setMicGranted] = useState(false);
  const [systemControlGranted, setSystemControlGranted] = useState(false);
  const [apiReachable, setApiReachable] = useState(true);
  const [voiceState, setVoiceState] = useState<VoiceState | "idle">("idle");
  const [voiceMode, setVoiceMode] = useState(() => localStorage.getItem(VOICE_MODE_KEY) === "true");
  const [now, setNow] = useState(() => new Date());

  const recorder = useVoiceRecorder();
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refreshConversations = useCallback(() => {
    listConversations()
      .then((list) => {
        setConversations(list);
        setApiReachable(true);
      })
      .catch(() => setApiReachable(false));
  }, []);

  useEffect(() => {
    isVoiceAvailable()
      .then(setMicGranted)
      .catch(() => setMicGranted(false));
    getActiveCapabilities()
      .then((active) => setSystemControlGranted(active.has("system_control")))
      .catch(() => undefined);
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  function toggleVoiceMode(): void {
    setVoiceMode((prev) => {
      const next = !prev;
      localStorage.setItem(VOICE_MODE_KEY, String(next));
      return next;
    });
  }

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return undefined;
      setError(null);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
      setInput("");
      setSending(true);
      try {
        const result = await sendChatMessage(text, conversationId);
        setConversationId(result.conversationId);
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: result.reply }]);
        refreshConversations();
        return result.reply;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not reach Omnira. Check your connection.");
        return undefined;
      } finally {
        setSending(false);
        // Sending clears the input but the field itself can lose focus (e.g.
        // after a mic-driven send) — bring it back so the user can keep typing.
        inputRef.current?.focus();
      }
    },
    [conversationId, refreshConversations],
  );

  async function speakReply(text: string): Promise<void> {
    setVoiceState(VoiceState.Speaking);
    try {
      await speak(text);
    } catch {
      // Non-fatal: the reply is already visible as text, so a synthesis
      // failure (e.g. no speechSynthesis in this webview) is silent-safe.
    } finally {
      setVoiceState("idle");
    }
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const reply = await send(input);
    if (reply && voiceMode) await speakReply(reply);
  }

  function handleNewChat(): void {
    setConversationId(undefined);
    setMessages([]);
    setInput("");
    setError(null);
    inputRef.current?.focus();
  }

  async function handleSelectConversation(id: string): Promise<void> {
    if (id === conversationId) return;
    setError(null);
    try {
      const history = await getConversationMessages(id);
      setMessages(history.map((m) => ({ id: crypto.randomUUID(), role: m.role, text: m.content })));
      setConversationId(id);
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load that conversation.");
    }
  }

  async function handleMicPressStart(): Promise<void> {
    setVoiceState(VoiceState.Listening);
    try {
      await recorder.start();
    } catch {
      setError("Could not access the microphone.");
      setVoiceState("idle");
    }
  }

  async function handleMicPressEnd(): Promise<void> {
    setVoiceState(VoiceState.Thinking);
    try {
      const audio = await recorder.stop();
      const text = await transcribeAudio(audio);
      if (voiceMode) {
        // Voice mode is a full loop: speak the command, Omnira acts and
        // replies out loud — no extra click to confirm what was heard.
        const reply = await send(text);
        if (reply) await speakReply(reply);
      } else {
        // Voice mode off: surface the transcript for review/edit before sending.
        setInput(text);
        inputRef.current?.focus();
        setVoiceState("idle");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not transcribe that. Try again.");
      setVoiceState("idle");
    }
  }

  return (
    <div className="omnira-hud-shell">
      <div className="omnira-hud-grid" aria-hidden="true" />

      <header className="omnira-hud-topbar omnira-glass omnira-hud-panel" style={headerStyle}>
        <h1 className="omnira-gradient-text" style={{ fontSize: "var(--omnira-text-lg)", fontWeight: 700, margin: 0 }}>
          OMNIRA
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--omnira-space-4)" }}>
          <span className="omnira-hud-indicator" data-active={micGranted}>
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Mic
          </span>
          <span className="omnira-hud-indicator" data-active={systemControlGranted}>
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Sys
          </span>
          <span className="omnira-hud-indicator" data-active={apiReachable}>
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Net
          </span>
          <span className="omnira-hud-value" style={{ fontSize: "var(--omnira-text-sm)" }}>
            {now.toLocaleTimeString()}
          </span>
          <button
            type="button"
            className="omnira-hud-switch"
            data-on={voiceMode}
            onClick={toggleVoiceMode}
            aria-pressed={voiceMode}
          >
            Voice mode
            <span className="omnira-hud-switch__track" aria-hidden="true">
              <span className="omnira-hud-switch__thumb" />
            </span>
          </button>
        </div>
      </header>

      <div className="omnira-hud-sidebar">
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={conversationId}
          onSelect={(id) => void handleSelectConversation(id)}
          onNewChat={handleNewChat}
        />
      </div>

      <div className="omnira-hud-center" style={centerStyle}>
        <div style={{ position: "relative", display: "inline-flex" }}>
          <span className="omnira-hud-radar" aria-hidden="true" />
          <MicButton
            state={voiceState}
            size="lg"
            disabled={!micGranted}
            disabledReason="Grant microphone access in settings to use voice"
            onPressStart={handleMicPressStart}
            onPressEnd={() => void handleMicPressEnd()}
          />
        </div>
        <p className="omnira-hud-label" style={{ marginTop: "var(--omnira-space-4)" }}>
          {STATE_TEXT[voiceState]}
        </p>
        {error && (
          <p role="alert" style={{ color: "var(--omnira-danger)", fontSize: "var(--omnira-text-sm)", textAlign: "center" }}>
            {error}
          </p>
        )}
      </div>

      <div className="omnira-hud-commlog omnira-glass omnira-hud-panel" style={commLogStyle}>
        <p className="omnira-hud-label" style={{ margin: 0 }}>
          Comm log
        </p>
        {messages.length === 0 && !sending && (
          <p style={{ color: "var(--omnira-text-secondary)", fontSize: "var(--omnira-text-sm)" }}>
            Say hello, or hold the core to talk.
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role}>
            {m.text}
          </MessageBubble>
        ))}
        {sending && <TypingIndicator />}
        <div ref={scrollAnchorRef} />
      </div>

      <form onSubmit={handleSubmit} className="omnira-hud-console omnira-glass omnira-hud-panel" style={consoleStyle}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Omnira…"
          disabled={sending}
          autoFocus
          className="omnira-input"
          style={{ flex: 1, border: "none", background: "transparent" }}
        />
        <Button type="submit" disabled={sending || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "var(--omnira-space-3) var(--omnira-space-4)",
} as const;

const centerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--omnira-space-2)",
} as const;

const commLogStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--omnira-space-3)",
  padding: "var(--omnira-space-3) var(--omnira-space-4)",
  overflowY: "auto",
} as const;

const consoleStyle = {
  display: "flex",
  gap: "var(--omnira-space-3)",
  padding: "var(--omnira-space-3)",
  alignItems: "center",
} as const;
