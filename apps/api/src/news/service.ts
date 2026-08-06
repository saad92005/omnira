import { XMLParser } from "fast-xml-parser";
import { UpstreamError } from "@omnira/core";

export interface NewsHeadline {
  title: string;
  link: string;
}

/**
 * BBC News' public RSS feed — no key, no signup, genuinely free. Fetched
 * server-side specifically because RSS feeds generally don't set CORS
 * headers permitting a direct browser fetch; a client-side call to this
 * same URL would just fail. No fabricated headlines: if the feed is
 * unreachable or malformed, this throws rather than returning invented
 * data.
 */
const FEED_URL = "https://feeds.bbci.co.uk/news/rss.xml";
const MAX_HEADLINES = 6;

const parser = new XMLParser({ ignoreAttributes: true });

interface RssItem {
  title?: unknown;
  link?: unknown;
}

export async function fetchTopHeadlines(): Promise<NewsHeadline[]> {
  let response: Response;
  try {
    response = await fetch(FEED_URL, { headers: { "User-Agent": "Omnira/1.0" } });
  } catch (err) {
    throw new UpstreamError(`Could not reach the news feed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!response.ok) {
    throw new UpstreamError(`News feed request failed with status ${response.status}`, { status: response.status });
  }

  const xml = await response.text();
  const parsed = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } };
  const rawItems = parsed.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return items
    .map((item) => ({ title: String(item.title ?? "").trim(), link: String(item.link ?? "").trim() }))
    .filter((item) => item.title.length > 0 && item.link.length > 0)
    .slice(0, MAX_HEADLINES);
}
