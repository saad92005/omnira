import { useCallback, useEffect, useRef, useState } from "react";
import {
  disconnectIntegration,
  getIntegrationConnectUrl,
  getIntegrationStatus,
  type IntegrationProvider,
  type IntegrationStatus,
} from "../api-client.js";
import { openInSystemBrowser } from "../system-browser.js";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

export interface UseIntegrationConnectionResult {
  /** null while the initial status check is in flight. */
  status: IntegrationStatus | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Owns the "connect via OAuth in the system browser, then poll until it
 * lands" flow shared by Calendar (Google) and Music (Spotify) — the
 * callback is handled server-side (apps/api), so this component has no
 * direct signal for "the user just finished in their browser" other than
 * asking the status endpoint again until it says connected.
 */
export function useIntegrationConnection(provider: IntegrationProvider): UseIntegrationConnectionResult {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshStatus = useCallback(async () => {
    const next = await getIntegrationStatus(provider);
    setStatus(next);
    return next;
  }, [provider]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
    setConnecting(false);
  }, []);

  useEffect(() => {
    refreshStatus().catch((err) => setError(err instanceof Error ? err.message : "Could not check connection status."));
    return stopPolling;
  }, [refreshStatus, stopPolling]);

  const connect = useCallback(async () => {
    setError(null);
    let url: string;
    try {
      url = await getIntegrationConnectUrl(provider);
      await openInSystemBrowser(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the connection.");
      return;
    }

    setConnecting(true);
    pollRef.current = setInterval(() => {
      refreshStatus()
        .then((next) => {
          if (next.connected) stopPolling();
        })
        .catch(() => {
          // A single missed poll tick isn't fatal — keep trying until the timeout below.
        });
    }, POLL_INTERVAL_MS);
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setError("Didn't detect a connection — if you approved it in the browser, reopen this panel to check again.");
    }, POLL_TIMEOUT_MS);
  }, [provider, refreshStatus, stopPolling]);

  const disconnect = useCallback(async () => {
    setError(null);
    try {
      await disconnectIntegration(provider);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
    }
  }, [provider, refreshStatus]);

  return { status, connecting, error, connect, disconnect };
}
