import { UpstreamError } from "@omnira/core";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
}

interface GoogleEvent {
  id?: string;
  summary?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const LOOKAHEAD_DAYS = 14;
const MAX_EVENTS = 10;

/** The next `MAX_EVENTS` real events on the user's primary calendar, next `LOOKAHEAD_DAYS` days — no invented events. */
export async function fetchUpcomingEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(MAX_EVENTS),
  });

  let response: Response;
  try {
    response = await fetch(`${EVENTS_URL}?${params.toString()}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    throw new UpstreamError(`Could not reach Google Calendar: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!response.ok) {
    throw new UpstreamError(`Google Calendar request failed (${response.status})`, { status: response.status });
  }

  const body = (await response.json()) as { items?: GoogleEvent[] };
  return (body.items ?? [])
    .filter((item): item is GoogleEvent & { id: string; summary: string } => Boolean(item.id && item.summary))
    .map((item) => {
      const allDay = Boolean(item.start?.date);
      return {
        id: item.id,
        title: item.summary,
        start: item.start?.dateTime ?? item.start?.date ?? "",
        end: item.end?.dateTime ?? item.end?.date ?? "",
        allDay,
        location: item.location ?? null,
      };
    });
}
