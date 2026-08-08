import { UpstreamError } from "@omnira/core";

export interface NowPlaying {
  isPlaying: boolean;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  progressMs: number | null;
  durationMs: number | null;
}

interface SpotifyImage {
  url?: string;
}

interface SpotifyCurrentlyPlaying {
  is_playing?: boolean;
  progress_ms?: number;
  item?: {
    name?: string;
    duration_ms?: number;
    artists?: Array<{ name?: string }>;
    album?: { images?: SpotifyImage[] };
  };
}

const NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing";

/** null means genuinely nothing playing right now (Spotify returns 204) — not an error, not a fabricated "idle" track. */
export async function fetchNowPlaying(accessToken: string): Promise<NowPlaying | null> {
  let response: Response;
  try {
    response = await fetch(NOW_PLAYING_URL, { headers: { authorization: `Bearer ${accessToken}` } });
  } catch (err) {
    throw new UpstreamError(`Could not reach Spotify: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (response.status === 204) return null;
  if (!response.ok) {
    throw new UpstreamError(`Spotify request failed (${response.status})`, { status: response.status });
  }

  const body = (await response.json()) as SpotifyCurrentlyPlaying;
  if (!body.item) return null;

  return {
    isPlaying: Boolean(body.is_playing),
    trackName: body.item.name ?? "Unknown track",
    artistName: (body.item.artists ?? []).map((a) => a.name).filter(Boolean).join(", ") || "Unknown artist",
    albumArtUrl: body.item.album?.images?.[0]?.url ?? null,
    progressMs: body.progress_ms ?? null,
    durationMs: body.item.duration_ms ?? null,
  };
}
