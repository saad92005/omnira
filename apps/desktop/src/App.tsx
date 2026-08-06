import { useState, type ReactNode } from "react";
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
 */
export function App(): ReactNode {
  const [stage, setStage] = useState<Stage>(initialStage);

  if (stage === "auth") {
    return <LoginForm onAuthenticated={() => setStage("onboarding")} />;
  }
  if (stage === "onboarding") {
    return <Onboarding onComplete={() => setStage("chat")} />;
  }
  return <ChatView />;
}
