import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Download,
  Mic2,
  Send,
  ShieldCheck,
  Sun,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, MessageBubble, MicButton, TypingIndicator, VoiceState, useTilt3D } from "@omnira/ui-kit";
import {
  ApiError,
  getActiveCapabilities,
  getConversationMessages,
  getNewsHeadlines,
  isVoiceAvailable,
  listConversations,
  sendChatMessage,
  transcribeAudio,
  type ConversationSummary,
  type NewsHeadline,
} from "../api-client.js";
import { runClientAction } from "../client-actions.js";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder.js";
import { speak } from "../speech.js";
import { getCurrentWeather, type CurrentWeather } from "../weather.js";
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

/** Maps Open-Meteo's WMO weather codes to a representative icon. */
function weatherIcon(code: number): typeof Sun {
  if (code === 0 || code === 1) return Sun;
  if (code === 2 || code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

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
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);

  const recorder = useVoiceRecorder();
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const commLogTilt = useTilt3D<HTMLDivElement>(3);

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
    // Best-effort and silent: a denied location prompt or offline moment
    // just means no weather widget, never an error banner over something
    // this ambient.
    getCurrentWeather().then(setWeather);
    getNewsHeadlines()
      .then(setHeadlines)
      .catch(() => undefined);
  }, [refreshConversations]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target;
      const isTypingContext = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

      // "/" jumps focus to the message input from anywhere on the page —
      // never intercepted while already typing, so it can still be typed
      // as a literal character in the message itself.
      if (event.key === "/" && !isTypingContext && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Ctrl/Cmd+Shift+K for a new chat — avoids Ctrl+N and Ctrl+K, both of
      // which browsers reserve (new window / address bar) and won't let a
      // page's preventDefault override.
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        handleNewChat();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
        result.clientActions.forEach((action) => void runClientAction(action));
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

  function handleExportConversation(): void {
    if (messages.length === 0) return;
    const body = messages.map((m) => `**${m.role === "user" ? "You" : "Omnira"}:** ${m.text}`).join("\n\n");
    const blob = new Blob([`# Omnira conversation\n\n${body}\n`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `omnira-conversation-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
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
    } catch (err) {
      const message = err instanceof Error && err.name === "NotAllowedError"
        ? "Microphone access was blocked. Check your browser's site permissions."
        : err instanceof Error
          ? `Could not access the microphone: ${err.message}`
          : "Could not access the microphone.";
      setError(message);
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
      // Surface the real error whenever there is one (a recorder failure,
      // an empty recording, an actual server message) instead of a generic
      // string that hides what actually went wrong — that genericness was
      // exactly what made an earlier real bug here hard to diagnose.
      const message =
        err instanceof ApiError || err instanceof Error ? err.message : "Could not transcribe that. Try again.";
      setError(message);
      setVoiceState("idle");
    }
  }

  return (
    <div className="omnira-hud-shell">
      <div className="omnira-hud-grid" aria-hidden="true" />

      <header className="omnira-hud-topbar omnira-glass omnira-hud-panel omnira-boot-topbar" style={headerStyle}>
        <h1 className="omnira-gradient-text" style={{ fontSize: "var(--omnira-text-lg)", fontWeight: 700, margin: 0 }}>
          OMNIRA
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--omnira-space-4)" }}>
          <span className="omnira-hud-indicator" data-active={micGranted}>
            <Mic2 size={12} strokeWidth={2} aria-hidden="true" />
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Mic
          </span>
          <span className="omnira-hud-indicator" data-active={systemControlGranted}>
            <ShieldCheck size={12} strokeWidth={2} aria-hidden="true" />
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Sys
          </span>
          <span className="omnira-hud-indicator" data-active={apiReachable}>
            <Wifi size={12} strokeWidth={2} aria-hidden="true" />
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Net
          </span>
          {weather && (
            <span
              className="omnira-hud-indicator"
              data-active="true"
              title={weather.label}
            >
              {(() => {
                const WeatherIcon = weatherIcon(weather.code);
                return <WeatherIcon size={13} strokeWidth={2} aria-hidden="true" />;
              })()}
              {weather.temperatureC}°C
            </span>
          )}
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

      <div className="omnira-hud-sidebar omnira-boot-sidebar">
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={conversationId}
          onSelect={(id) => void handleSelectConversation(id)}
          onNewChat={handleNewChat}
          headlines={headlines}
        />
      </div>

      <div className="omnira-hud-center" style={centerStyle}>
        <div className="omnira-boot-center" style={{ position: "relative", display: "inline-flex" }}>
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
        <p className="omnira-boot-text" style={{ margin: 0, height: 16 }} aria-hidden="true">
          Omnira online
        </p>
        {error && (
          <p role="alert" style={{ color: "var(--omnira-danger)", fontSize: "var(--omnira-text-sm)", textAlign: "center" }}>
            {error}
          </p>
        )}
      </div>

      <div
        ref={commLogTilt.ref}
        onPointerMove={commLogTilt.onPointerMove}
        onPointerLeave={commLogTilt.onPointerLeave}
        className="omnira-hud-commlog omnira-glass omnira-hud-panel omnira-tilt-3d omnira-boot-commlog"
        style={commLogStyle}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p className="omnira-hud-label" style={{ margin: 0 }}>
            Comm log
          </p>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleExportConversation}
              className="omnira-hud-label"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--omnira-accent-2)",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
              title="Download this conversation as a Markdown file"
            >
              <Download size={13} strokeWidth={2} /> Export
            </button>
          )}
        </div>
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

      <form onSubmit={handleSubmit} className="omnira-hud-console omnira-glass omnira-hud-panel omnira-boot-console" style={consoleStyle}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Omnira… (press / to focus)"
          title="Press / from anywhere to focus this field"
          disabled={sending}
          autoFocus
          className="omnira-input"
          style={{ flex: 1, border: "none", background: "transparent" }}
        />
        <Button type="submit" disabled={sending || !input.trim()}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            Send <Send size={14} strokeWidth={2} />
          </span>
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
