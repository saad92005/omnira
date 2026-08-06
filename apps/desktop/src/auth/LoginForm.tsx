import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@omnira/ui-kit";
import { login, register } from "../api-client.js";

export interface LoginFormProps {
  onAuthenticated: () => void;
}

export function LoginForm({ onAuthenticated }: LoginFormProps): ReactNode {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await register(email, password);
      }
      await login(email, password);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--omnira-space-3)",
        maxWidth: 360,
        margin: "var(--omnira-space-12) auto",
        padding: "var(--omnira-space-6)",
        background: "var(--omnira-surface)",
        border: "1px solid var(--omnira-border)",
        borderRadius: 12,
        fontFamily: "var(--omnira-font-sans)",
      }}
    >
      <h1 style={{ fontSize: "var(--omnira-text-lg)", margin: 0, color: "var(--omnira-text-primary)" }}>
        {mode === "login" ? "Sign in" : "Create an account"}
      </h1>
      <label style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-1)" }}>
        <span style={{ fontSize: "var(--omnira-text-sm)", color: "var(--omnira-text-secondary)" }}>Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-1)" }}>
        <span style={{ fontSize: "var(--omnira-text-sm)", color: "var(--omnira-text-secondary)" }}>Password</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
      </label>
      {error && (
        <p role="alert" style={{ color: "var(--omnira-danger)", fontSize: "var(--omnira-text-sm)", margin: 0 }}>
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        style={{
          background: "none",
          border: "none",
          color: "var(--omnira-text-secondary)",
          fontSize: "var(--omnira-text-sm)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}

const inputStyle = {
  padding: "var(--omnira-space-2)",
  borderRadius: 6,
  border: "1px solid var(--omnira-border)",
  background: "var(--omnira-bg)",
  color: "var(--omnira-text-primary)",
  fontSize: "var(--omnira-text-base)",
} as const;
