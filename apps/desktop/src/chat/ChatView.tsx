import { Send, ShieldCheck, Terminal, Wifi } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, MicButton, NerveField, VoiceState } from "@omnira/ui-kit";
import {
  ApiError,
  getActiveCapabilities,
  getAgents,
  getConversationMessages,
  getNewsHeadlines,
  grantMicrophonePermission,
  grantSystemControlPermission,
  isVoiceAvailable,
  listConversations,
  logout,
  revokeMicrophonePermission,
  sendChatMessage,
  transcribeAudio,
  type AgentPersonaSummary,
  type ConversationSummary,
  type NewsHeadline,
} from "../api-client.js";
import type { Automation } from "../automations.js";
import { runClientAction } from "../client-actions.js";
import { useAutomations } from "../hooks/useAutomations.js";
import { useEventLog } from "../hooks/useEventLog.js";
import { useMicLevelMeter } from "../hooks/useMicLevelMeter.js";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder.js";
import { speak } from "../speech.js";
import { getCurrentWeather, type CurrentWeather } from "../weather.js";
import { Dock } from "./Dock.js";
import { DockPanels } from "./DockPanels.js";
import { LeftSidebar } from "./LeftSidebar.js";
import { RightPanel } from "./RightPanel.js";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const VOICE_MODE_KEY = "omnira.voiceMode";
const AGENT_ID_KEY = "omnira.agentId";

const STATE_TEXT: Record<VoiceState | "idle", string> = {
  idle: "Idle",
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
  const [online, setOnline] = useState(() => navigator.onLine);
  const [voiceState, setVoiceState] = useState<VoiceState | "idle">("idle");
  const [voiceMode, setVoiceMode] = useState(() => localStorage.getItem(VOICE_MODE_KEY) === "true");
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentPersonaSummary[]>([]);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [agentId, setAgentId] = useState(() => localStorage.getItem(AGENT_ID_KEY) ?? "general");

  const recorder = useVoiceRecorder();
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const orbWrapRef = useRef<HTMLDivElement | null>(null);
  const { entries: logEntries, log } = useEventLog();
  const didLogBoot = useRef(false);

  // Real mic input level (Web Audio analyser on the actual recording
  // stream), written straight to a CSS custom property via ref rather than
  // React state — the glow can react at animation-frame rate without
  // forcing a re-render on every frame.
  const handleMicLevel = useCallback((level: number) => {
    orbWrapRef.current?.style.setProperty("--omnira-mic-level", String(level));
  }, []);
  useMicLevelMeter(recorder.stream, handleMicLevel);

  const refreshConversations = useCallback(() => {
    listConversations()
      .then((list) => {
        setConversations(list);
        setApiReachable(true);
      })
      .catch(() => setApiReachable(false));
  }, []);

  useEffect(() => {
    if (didLogBoot.current) return;
    didLogBoot.current = true;
    log("Omnira online");

    isVoiceAvailable()
      .then((granted) => {
        setMicGranted(granted);
        if (granted) log("Microphone access granted", "success");
      })
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
      .then((list) => {
        setHeadlines(list);
        log(`Fetched ${list.length} headlines`);
      })
      .catch(() => undefined);
    getAgents()
      .then(setAgents)
      .catch(() => undefined)
      .finally(() => setAgentsLoaded(true));
  }, [refreshConversations, log]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function goOnline(): void {
      setOnline(true);
      log("Internet connection restored", "success");
    }
    function goOffline(): void {
      setOnline(false);
      log("Internet connection lost", "warning");
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [log]);

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
      log(`Voice mode ${next ? "enabled" : "disabled"}`);
      return next;
    });
  }

  function handleDockSelect(id: string): void {
    if (id === "voice") {
      toggleVoiceMode();
      return;
    }
    if (id === "chat" || id === "dashboard") {
      setActiveModule(null);
      return;
    }
    setActiveModule(id);
  }

  function handleSelectAgent(id: string): void {
    setAgentId(id);
    localStorage.setItem(AGENT_ID_KEY, id);
    const label = agents.find((a) => a.id === id)?.label ?? id;
    log(`Agent switched to ${label}`);
  }

  async function handleGrantMic(): Promise<void> {
    await grantMicrophonePermission();
    setMicGranted(true);
    log("Microphone access granted", "success");
  }

  async function handleRevokeMic(): Promise<void> {
    await revokeMicrophonePermission();
    setMicGranted(false);
    log("Microphone access revoked", "warning");
  }

  async function handleGrantSystemControl(): Promise<void> {
    await grantSystemControlPermission();
    setSystemControlGranted(true);
    log("System control granted", "success");
  }

  function handleSignOut(): void {
    void logout();
    window.location.reload();
  }

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return undefined;
      setError(null);
      setLastCommand(text);
      log(`You: ${text}`);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
      setInput("");
      setSending(true);
      try {
        const result = await sendChatMessage(text, conversationId, agentId);
        setConversationId(result.conversationId);
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: result.reply }]);
        refreshConversations();
        result.clientActions.forEach((action) => void runClientAction(action));
        log("Omnira replied", "success");
        return result.reply;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Could not reach Omnira. Check your connection.";
        setError(message);
        log(message, "error");
        return undefined;
      } finally {
        setSending(false);
        // Sending clears the input but the field itself can lose focus (e.g.
        // after a mic-driven send) — bring it back so the user can keep typing.
        inputRef.current?.focus();
      }
    },
    [conversationId, agentId, refreshConversations, log],
  );

  const handleAutomationRun = useCallback(
    (automation: Automation) => {
      log(`Automation "${automation.label}" ran`, "success");
      void send(automation.message);
    },
    [send, log],
  );
  const { automations, addAutomation, removeAutomation, toggleAutomation } = useAutomations(handleAutomationRun);

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
    log("Exported conversation as Markdown");
  }

  function handleNewChat(): void {
    setConversationId(undefined);
    setMessages([]);
    setInput("");
    setError(null);
    setLastCommand(null);
    inputRef.current?.focus();
    log("Started a new chat");
  }

  async function handleSelectConversation(id: string): Promise<void> {
    if (id === conversationId) return;
    setError(null);
    try {
      const history = await getConversationMessages(id);
      setMessages(history.map((m) => ({ id: crypto.randomUUID(), role: m.role, text: m.content })));
      setConversationId(id);
      inputRef.current?.focus();
      log("Loaded conversation");
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
      log(message, "error");
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
      log(message, "error");
      setVoiceState("idle");
    }
  }

  return (
    <div className="omnira-hud-shell">
      <NerveField />

      <header className="omnira-hud-topbar omnira-glass omnira-hud-panel omnira-boot-topbar" style={headerStyle}>
        <h1
          className="omnira-gradient-text"
          style={{ fontFamily: "var(--omnira-font-display)", fontSize: "var(--omnira-text-lg)", fontWeight: 700, margin: 0, letterSpacing: "0.06em" }}
        >
          OMNIRA
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--omnira-space-4)" }}>
          <span className="omnira-hud-indicator" data-active="true">
            <Terminal size={12} strokeWidth={2} aria-hidden="true" />
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Groq · Llama 3.3
          </span>
          <span className="omnira-hud-indicator" data-active={systemControlGranted}>
            <ShieldCheck size={12} strokeWidth={2} aria-hidden="true" />
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Sys
          </span>
          <span className="omnira-hud-indicator" data-active={apiReachable && online}>
            <Wifi size={12} strokeWidth={2} aria-hidden="true" />
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Net
          </span>
          <span className="omnira-hud-value" style={{ fontSize: "var(--omnira-text-sm)" }}>
            {now.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {now.toLocaleTimeString()}
          </span>
        </div>
      </header>

      <div className="omnira-hud-sidebar omnira-boot-sidebar">
        <LeftSidebar
          conversations={conversations}
          activeConversationId={conversationId}
          onSelect={(id) => void handleSelectConversation(id)}
          onNewChat={handleNewChat}
          headlines={headlines}
          weather={weather}
          voiceMode={voiceMode}
          onToggleVoiceMode={toggleVoiceMode}
          onExportConversation={handleExportConversation}
          hasMessages={messages.length > 0}
        />
      </div>

      <div className="omnira-hud-center" style={centerStyle}>
        <div ref={orbWrapRef} className="omnira-boot-center" style={{ position: "relative", display: "inline-flex" }}>
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
        <p
          className="omnira-hud-label"
          style={{ marginTop: "var(--omnira-space-4)", fontFamily: "var(--omnira-font-heading)", fontSize: "var(--omnira-text-base)", textTransform: "none", letterSpacing: "normal", color: "var(--omnira-text-primary)" }}
        >
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

      <div className="omnira-hud-right omnira-boot-commlog">
        <RightPanel
          messages={messages}
          sending={sending}
          scrollAnchorRef={scrollAnchorRef}
          onExportConversation={handleExportConversation}
          aiStatusLabel={STATE_TEXT[voiceState]}
          currentCommand={lastCommand}
          apiReachable={apiReachable}
          online={online}
          micActive={voiceState === VoiceState.Listening}
          logEntries={logEntries}
          activeAgentLabel={agents.find((a) => a.id === agentId)?.label ?? "General"}
        />
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

      <div className="omnira-hud-dock">
        <Dock activeId={activeModule ?? "chat"} voiceMode={voiceMode} onSelect={handleDockSelect} />
      </div>

      <DockPanels
        activeModule={activeModule}
        onClose={() => setActiveModule(null)}
        conversations={conversations}
        onSelectConversation={(id) => void handleSelectConversation(id)}
        micGranted={micGranted}
        systemControlGranted={systemControlGranted}
        voiceMode={voiceMode}
        onToggleVoiceMode={toggleVoiceMode}
        onGrantMic={handleGrantMic}
        onRevokeMic={handleRevokeMic}
        onGrantSystemControl={handleGrantSystemControl}
        onSignOut={handleSignOut}
        automations={automations}
        addAutomation={addAutomation}
        removeAutomation={removeAutomation}
        toggleAutomation={toggleAutomation}
        agents={agents}
        agentsLoaded={agentsLoaded}
        activeAgentId={agentId}
        onSelectAgent={handleSelectAgent}
      />
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

const consoleStyle = {
  display: "flex",
  gap: "var(--omnira-space-3)",
  padding: "var(--omnira-space-3)",
  alignItems: "center",
} as const;
