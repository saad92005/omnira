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
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--omnira-space-4)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="omnira-glass omnira-card omnira-fade-in-up"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--omnira-space-4)",
          width: "100%",
          maxWidth: 380,
          fontFamily: "var(--omnira-font-sans)",
        }}
      >
        <div>
          <h1
            className="omnira-gradient-text"
            style={{ fontSize: "var(--omnira-text-xl)", margin: 0, fontWeight: 700 }}
          >
            Omnira
          </h1>
          <p style={{ margin: "var(--omnira-space-1) 0 0", color: "var(--omnira-text-secondary)", fontSize: "var(--omnira-text-sm)" }}>
            {mode === "login" ? "Welcome back." : "Create your account to get started."}
          </p>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-1)" }}>
          <span style={{ fontSize: "var(--omnira-text-sm)", color: "var(--omnira-text-secondary)" }}>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="omnira-input"
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
            className="omnira-input"
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
    </div>
  );
}
