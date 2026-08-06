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

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    // fetch() itself rejects (server unreachable, DNS failure, offline) with a
    // raw browser TypeError ("Failed to fetch") — not useful shown to a user.
    throw new ApiError("NETWORK_ERROR", "Could not reach Omnira. Check that the server is running.");
  }

  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as ApiErrorEnvelope | null;
    throw new ApiError(envelope?.error.code ?? "UNKNOWN", envelope?.error.message ?? response.statusText);
  }
  if (response.status === 204) return undefined as T;
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

export interface ClientAction {
  type: string;
  payload: Record<string, unknown>;
}

export async function sendChatMessage(
  message: string,
  conversationId?: string,
): Promise<{ conversationId: string; reply: string; clientActions: ClientAction[] }> {
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

export async function grantSystemControlPermission(): Promise<void> {
  await request("/permissions/system_control/grant", { method: "POST" });
}

export interface PermissionGrant {
  capability: string;
  revokedAt: string | null;
}

export async function getActiveCapabilities(): Promise<Set<string>> {
  const result = await request<{ grants: PermissionGrant[] }>("/permissions");
  return new Set(result.grants.filter((g) => g.revokedAt === null).map((g) => g.capability));
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const result = await request<{ conversations: ConversationSummary[] }>("/conversations");
  return result.conversations;
}

export interface PersistedMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getConversationMessages(conversationId: string): Promise<PersistedMessage[]> {
  const result = await request<{ messages: PersistedMessage[] }>(`/conversations/${conversationId}/messages`);
  return result.messages;
}

export interface NewsHeadline {
  title: string;
  link: string;
}

export async function getNewsHeadlines(): Promise<NewsHeadline[]> {
  const result = await request<{ headlines: NewsHeadline[] }>("/news/headlines");
  return result.headlines;
}

const AUDIO_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
};

export async function transcribeAudio(audio: Blob): Promise<string> {
  // The recorded blob's actual format varies by browser (iOS Safari records
  // audio/mp4, not audio/webm — see useVoiceRecorder.ts) — a hardcoded
  // ".webm" filename regardless of the real format was misleading the
  // server's format detection for any browser that doesn't record WebM.
  const baseType = audio.type.split(";")[0]?.trim() ?? "";
  const extension = AUDIO_EXTENSION_BY_MIME_TYPE[baseType] ?? "webm";
  const form = new FormData();
  form.append("file", audio, `utterance.${extension}`);
  const result = await request<{ text: string }>("/voice/transcribe", { method: "POST", body: form });
  return result.text;
}
