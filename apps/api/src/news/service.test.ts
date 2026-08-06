import { afterEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@omnira/core";
import { fetchTopHeadlines } from "./service.js";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BBC News</title>
    <item>
      <title>First real headline</title>
      <link>https://www.bbc.co.uk/news/1</link>
    </item>
    <item>
      <title>Second real headline</title>
      <link>https://www.bbc.co.uk/news/2</link>
    </item>
  </channel>
</rss>`;

describe("fetchTopHeadlines", () => {
  it("parses real titles and links out of the RSS feed, never inventing any", async () => {
    global.fetch = vi.fn(async () => new Response(SAMPLE_RSS, { status: 200 })) as never;

    const headlines = await fetchTopHeadlines();

    expect(headlines).toEqual([
      { title: "First real headline", link: "https://www.bbc.co.uk/news/1" },
      { title: "Second real headline", link: "https://www.bbc.co.uk/news/2" },
    ]);
  });

  it("throws instead of returning fabricated data when the feed is unreachable", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("network down");
    }) as never;

    await expect(fetchTopHeadlines()).rejects.toBeInstanceOf(UpstreamError);
  });

  it("throws on a non-2xx response instead of silently returning an empty/fake list", async () => {
    global.fetch = vi.fn(async () => new Response("", { status: 503 })) as never;

    await expect(fetchTopHeadlines()).rejects.toBeInstanceOf(UpstreamError);
  });

  it("caps the result at 6 headlines even if the feed has more", async () => {
    const items = Array.from(
      { length: 10 },
      (_, i) => `<item><title>Headline ${i}</title><link>https://example.com/${i}</link></item>`,
    ).join("");
    global.fetch = vi.fn(
      async () => new Response(`<rss><channel>${items}</channel></rss>`, { status: 200 }),
    ) as never;

    const headlines = await fetchTopHeadlines();
    expect(headlines).toHaveLength(6);
  });
});
