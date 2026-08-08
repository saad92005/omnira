import { Disc3, Music2, Pause, Play } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@omnira/ui-kit";
import { getSpotifyNowPlaying, type NowPlaying } from "../api-client.js";
import { isDesktopRuntime } from "../files.js";
import { useIntegrationConnection } from "../hooks/useIntegrationConnection.js";

const POLL_MS = 5000;

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * A real Spotify connection (OAuth) showing whatever is genuinely playing on
 * the user's own account right now. Read-only by design: playback control
 * is restricted to Premium accounts by Spotify's own API, so it isn't built
 * here — "what's playing" works on any account.
 */
export function MusicPanel(): ReactNode {
  const { status, connecting, error, connect, disconnect } = useIntegrationConnection("spotify");
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null | undefined>(undefined);
  const [nowPlayingError, setNowPlayingError] = useState<string | null>(null);

  useEffect(() => {
    if (!status?.connected) return;
    let cancelled = false;
    const poll = (): void => {
      getSpotifyNowPlaying()
        .then((result) => {
          if (!cancelled) setNowPlaying(result);
        })
        .catch((err) => {
          if (!cancelled) setNowPlayingError(err instanceof Error ? err.message : "Could not check what's playing.");
        });
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status?.connected]);

  if (!isDesktopRuntime()) {
    return (
      <p style={{ margin: 0 }}>
        Connecting real music needs the actual Omnira desktop app — install the Windows app to use this.
      </p>
    );
  }

  if (!status) {
    return <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "12px" }}>Checking connection…</p>;
  }

  if (!status.connected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-2)" }}>
        <p style={{ margin: 0, fontSize: "12px", color: "var(--omnira-text-secondary)" }}>
          Connect Spotify to see what's really playing on your account. Playback control needs Spotify Premium per
          Spotify's own API restriction, so only reading "what's playing" is built here.
        </p>
        {error && (
          <p role="alert" style={{ margin: 0, color: "var(--omnira-danger)", fontSize: "var(--omnira-text-xs)" }}>
            {error}
          </p>
        )}
        <Button variant="primary" disabled={connecting} onClick={() => void connect()}>
          {connecting ? "Waiting for approval in your browser…" : "Connect Spotify"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-2)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" className="omnira-chip" onClick={() => void disconnect()}>
          Disconnect
        </button>
      </div>
      {nowPlayingError && (
        <p role="alert" style={{ margin: 0, color: "var(--omnira-danger)", fontSize: "var(--omnira-text-xs)" }}>
          {nowPlayingError}
        </p>
      )}
      {nowPlaying === undefined && !nowPlayingError && (
        <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "12px" }}>Checking what's playing…</p>
      )}
      {nowPlaying === null && (
        <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "12px" }}>
          <Music2 size={13} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          Nothing playing on Spotify right now.
        </p>
      )}
      {nowPlaying && (
        <div style={{ display: "flex", gap: "var(--omnira-space-2)", alignItems: "center" }}>
          {nowPlaying.albumArtUrl ? (
            <img
              src={nowPlaying.albumArtUrl}
              alt=""
              style={{ width: 48, height: 48, borderRadius: "var(--omnira-radius-sm)", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--omnira-radius-sm)",
                background: "rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Disc3 size={20} strokeWidth={1.5} style={{ color: "var(--omnira-text-secondary)" }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                color: "var(--omnira-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {nowPlaying.trackName}
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "11.5px",
                color: "var(--omnira-text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {nowPlaying.artistName}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--omnira-text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
              {nowPlaying.isPlaying ? <Play size={11} strokeWidth={2} /> : <Pause size={11} strokeWidth={2} />}
              {nowPlaying.progressMs != null && nowPlaying.durationMs != null
                ? `${formatMs(nowPlaying.progressMs)} / ${formatMs(nowPlaying.durationMs)}`
                : nowPlaying.isPlaying
                  ? "Playing"
                  : "Paused"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
