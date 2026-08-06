import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, MessageBubble, MicButton, VoiceState } from "@omnira/ui-kit";
import { ApiError, isVoiceAvailable, sendChatMessage, speakText, transcribeAudio } from "../api-client.js";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder.js";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export function ChatView(): ReactNode {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState | "idle">("idle");

  const recorder = useVoiceRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    isVoiceAvailable()
      .then(setVoiceAvailable)
      .catch(() => setVoiceAvailable(false));
  }, []);

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
        return result.reply;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not reach Omnira. Check your connection.");
        return undefined;
      } finally {
        setSending(false);
      }
    },
    [conversationId],
  );

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const reply = await send(input);
    if (reply) await speakReply(reply);
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
      const audioData = await speakText(text);
      const blob = new Blob([audioData], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      await audioRef.current.play();
      audioRef.current.onended = () => URL.revokeObjectURL(url);
    } finally {
      setVoiceState("idle");
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "var(--omnira-font-sans)",
        background: "var(--omnira-bg)",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--omnira-space-4)", display: "flex", flexDirection: "column", gap: "var(--omnira-space-3)" }}>
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role}>
            {m.text}
          </MessageBubble>
        ))}
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--omnira-danger)", fontSize: "var(--omnira-text-sm)", padding: "0 var(--omnira-space-4)" }}>
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: "var(--omnira-space-2)",
          padding: "var(--omnira-space-4)",
          borderTop: "1px solid var(--omnira-border)",
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Omnira…"
          disabled={sending}
          style={{
            flex: 1,
            padding: "var(--omnira-space-2) var(--omnira-space-3)",
            borderRadius: 8,
            border: "1px solid var(--omnira-border)",
            background: "var(--omnira-surface)",
            color: "var(--omnira-text-primary)",
            fontSize: "var(--omnira-text-base)",
          }}
        />
        <Button type="submit" disabled={sending || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
