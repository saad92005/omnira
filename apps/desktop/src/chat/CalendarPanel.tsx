import { CalendarDays, MapPin } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@omnira/ui-kit";
import { getCalendarEvents, type CalendarEvent } from "../api-client.js";
import { isDesktopRuntime } from "../files.js";
import { useIntegrationConnection } from "../hooks/useIntegrationConnection.js";

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  return new Date(event.start).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * A real Google Calendar connection (OAuth, calendar.readonly scope) — the
 * next real events on the user's primary calendar, nothing shown or
 * invented until they actually connect their own account.
 */
export function CalendarPanel(): ReactNode {
  const { status, connecting, error, connect, disconnect } = useIntegrationConnection("google_calendar");
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);

  useEffect(() => {
    if (!status?.connected) return;
    getCalendarEvents()
      .then(setEvents)
      .catch((err) => setEventsError(err instanceof Error ? err.message : "Could not load your calendar."));
  }, [status?.connected]);

  if (!isDesktopRuntime()) {
    return (
      <p style={{ margin: 0 }}>
        Connecting a real calendar needs the actual Omnira desktop app — install the Windows app to use this.
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
          Connect your real Google Calendar to see upcoming events here — nothing is shown until you do. Opens in
          your default browser for the sign-in step, then comes back here on its own.
        </p>
        {error && (
          <p role="alert" style={{ margin: 0, color: "var(--omnira-danger)", fontSize: "var(--omnira-text-xs)" }}>
            {error}
          </p>
        )}
        <Button variant="primary" disabled={connecting} onClick={() => void connect()}>
          {connecting ? "Waiting for approval in your browser…" : "Connect Google Calendar"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: "12px", color: "var(--omnira-text-secondary)" }}>Next events on your calendar.</p>
        <button type="button" className="omnira-chip" onClick={() => void disconnect()}>
          Disconnect
        </button>
      </div>
      {eventsError && (
        <p role="alert" style={{ margin: 0, color: "var(--omnira-danger)", fontSize: "var(--omnira-text-xs)" }}>
          {eventsError}
        </p>
      )}
      {!events && !eventsError && (
        <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "12px" }}>Loading events…</p>
      )}
      {events && events.length === 0 && (
        <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "12px" }}>
          Nothing on your calendar for the next two weeks.
        </p>
      )}
      {events && events.length > 0 && (
        <div className="omnira-modal__conversation-list">
          {events.map((event) => (
            <div key={event.id} className="omnira-conversation-item" style={{ cursor: "default" }}>
              <p style={{ margin: 0, color: "var(--omnira-text-primary)" }}>{event.title}</p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "11.5px",
                  color: "var(--omnira-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flexWrap: "wrap",
                }}
              >
                <CalendarDays size={11} strokeWidth={2} /> {formatEventTime(event)}
                {event.location && (
                  <>
                    <MapPin size={11} strokeWidth={2} style={{ marginLeft: 6 }} /> {event.location}
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
