import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, MessageBubble, MicButton, TypingIndicator, VoiceState } from "@omnira/ui-kit";
import {
  ApiError,
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

export function ChatView(): ReactNode {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState | "idle">("idle");

  const recorder = useVoiceRecorder();
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refreshConversations = useCallback(() => {
    listConversations()
      .then(setConversations)
      .catch(() => {
        /* Non-critical — the sidebar just stays as-is. */
      });
  }, []);

  useEffect(() => {
    isVoiceAvailable()
      .then(setVoiceAvailable)
      .catch(() => setVoiceAvailable(false));
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
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

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const reply = await send(input);
    if (reply) await speakReply(reply);
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
      // Show the transcript before sending — misheard input must stay visible and editable.
      setInput(text);
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not transcribe that. Try again.");
    } finally {
      setVoiceState("idle");
    }
  }

  async function speakReply(text: string): Promise<void> {
    if (!voiceAvailable) return;
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

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "var(--omnira-font-sans)" }}>
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={conversationId}
        onSelect={(id) => void handleSelectConversation(id)}
        onNewChat={handleNewChat}
      />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <header
          style={{
            padding: "var(--omnira-space-3) var(--omnira-space-4)",
            display: "flex",
            alignItems: "center",
            gap: "var(--omnira-space-2)",
          }}
        >
          <h1 className="omnira-gradient-text" style={{ fontSize: "var(--omnira-text-lg)", fontWeight: 700, margin: 0 }}>
            Omnira
          </h1>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 var(--omnira-space-4) var(--omnira-space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--omnira-space-3)",
          }}
        >
          {messages.length === 0 && !sending && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--omnira-space-2)",
                color: "var(--omnira-text-secondary)",
                fontSize: "var(--omnira-text-sm)",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0 }}>Say hello, or hold the orb below to talk.</p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role}>
              {m.text}
            </MessageBubble>
          ))}
          {sending && <TypingIndicator />}
          <div ref={scrollAnchorRef} />
        </div>

        {error && (
          <p
            role="alert"
            style={{ color: "var(--omnira-danger)", fontSize: "var(--omnira-text-sm)", padding: "0 var(--omnira-space-4)" }}
          >
            {error}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="omnira-glass"
          style={{
            display: "flex",
            gap: "var(--omnira-space-3)",
            margin: "var(--omnira-space-4)",
            marginTop: 0,
            padding: "var(--omnira-space-3)",
            alignItems: "center",
          }}
        >
          <MicButton
            state={voiceState}
            disabled={!voiceAvailable}
            disabledReason="Grant microphone access in settings to use voice"
            onPressStart={handleMicPressStart}
            onPressEnd={() => void handleMicPressEnd()}
          />
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
    </div>
  );
}
