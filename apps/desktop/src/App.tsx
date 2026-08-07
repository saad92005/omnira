import { useState, type ReactNode } from "react";
import { AuroraBackground, CursorGlow } from "@omnira/ui-kit";
import { isAuthenticated } from "./api-client.js";
import { LoginForm } from "./auth/LoginForm.js";
import { Onboarding } from "./onboarding/Onboarding.js";
import { ChatView } from "./chat/ChatView.js";

type Stage = "auth" | "onboarding" | "chat";

function initialStage(): Stage {
  return isAuthenticated() ? "chat" : "auth";
}

/**
 * First-run journey (master prompt §3.1, reduced to Phase 0 scope): sign in
 * → grant-or-skip the microphone permission → chat. Onboarding only runs
 * once per session here — Phase 1 persists "has completed onboarding"
 * server-side so it doesn't re-appear on every launch.
 *
 * AuroraBackground renders exactly once here, at the root, per
 * /docs/DESIGN_SYSTEM.md — never per-screen.
 */
export function App(): ReactNode {
  const [stage, setStage] = useState<Stage>(initialStage);

  return (
    <>
      <AuroraBackground />
      <CursorGlow />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>
        {stage === "auth" && <LoginForm onAuthenticated={() => setStage("onboarding")} />}
        {stage === "onboarding" && <Onboarding onComplete={() => setStage("chat")} />}
        {stage === "chat" && <ChatView />}
      </div>
    </>
  );
}
