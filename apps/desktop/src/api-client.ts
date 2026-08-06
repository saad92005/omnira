/**
 * Thin fetch wrapper for apps/api. Tokens are kept in localStorage for the
 * Phase 0 walking skeleton — revisit with OS-keychain storage once
 * desktop-bridge exists in Phase 1 to manage secrets like this properly.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/v1";

const ACCESS_TOKEN_KEY = "omnira.accessToken";
const REFRESH_TOKEN_KEY = "omnira.refreshToken";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

interface ApiErrorEnvelope {
  error: { code: string; message: string; requestId: string };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as ApiErrorEnvelope | null;
    throw new ApiError(envelope?.error.code ?? "UNKNOWN", envelope?.error.message ?? response.statusText);
  }
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("audio/")) {
    return (await response.arrayBuffer()) as T;
  }
  return (await response.json()) as T;
}

export async function register(email: string, password: string): Promise<void> {
  await request("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function login(email: string, password: string): Promise<void> {
  const tokens = await request<{ accessToken: string; refreshToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setTokens(tokens.accessToken, tokens.refreshToken);
}

export async function sendChatMessage(
  message: string,
  conversationId?: string,
): Promise<{ conversationId: string; reply: string }> {
  return request("/chat", { method: "POST", body: JSON.stringify({ message, conversationId }) });
}

export async function isVoiceAvailable(): Promise<boolean> {
  const result = await request<{ voiceAvailable: boolean }>("/chat/voice-available");
  return result.voiceAvailable;
}

export async function grantMicrophonePermission(): Promise<void> {
  await request("/permissions/microphone/grant", { method: "POST" });
}

export async function revokeMicrophonePermission(): Promise<void> {
  await request("/permissions/microphone/revoke", { method: "POST" });
}

export async function transcribeAudio(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "utterance.webm");
  const result = await request<{ text: string }>("/voice/transcribe", { method: "POST", body: form });
  return result.text;
}

export async function speakText(text: string): Promise<ArrayBuffer> {
  return request<ArrayBuffer>("/voice/speak", { method: "POST", body: JSON.stringify({ text }) });
}
