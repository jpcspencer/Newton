import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RawArticle = {
  title: string;
  description: string;
  sourceName: string;
  publishedAt: string;
  url: string;
};

type EnrichedArticle = {
  title: string;
  newtonSummary: string;
  sourceName: string;
  publishedAt: string;
  url: string;
  importance: number;
  noc: string | null;
  tag: string;
};

type ClaudeEnrichment = {
  newtonSummary?: string;
  importance?: number;
  noc?: string | null;
  tag?: string;
};

const ENRICHMENT_SYSTEM =
  "You are Newton, a warm and curious AI research companion. You interpret science and technology news with intelligence and clarity. Always respond in valid JSON only, no markdown, no backticks. The importance field MUST be a number between 1 and 5.";

const ENRICHMENT_USER_TEMPLATE = `Enrich this article for the Newton feed. Return a JSON object with these fields:
- newtonSummary: a 2-3 sentence summary in Newton's voice — clear, intelligent, no jargon, written for a curious non-expert
- importance: a number 1-5 (integer) based on genuine significance to science and technology — must be a number, not a string
- noc: one sentence describing a non-obvious connection this story has to another field — only include if genuinely interesting, otherwise return null
- tag: one word category tag like "AI", "Space", "Biotech", "Physics", "Climate"

Article title: {title}
Article description: {description}`;

function parseImportance(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.min(5, Math.max(1, Math.round(value)));
  }
  if (typeof value === "string") {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      return Math.min(5, Math.max(1, Math.round(n)));
    }
  }
  return 3;
}

async function enrichArticle(article: RawArticle, anthropicKey: string): Promise<EnrichedArticle> {
  const userPrompt = ENRICHMENT_USER_TEMPLATE.replace("{title}", article.title).replace(
    "{description}",
    article.description
  );

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: ENRICHMENT_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const textContent = data.content?.find((b) => b.type === "text");
    const text = textContent?.text ?? "";

    let parsed: ClaudeEnrichment = {};

    try {
      const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(cleaned) as ClaudeEnrichment;
    } catch {
      console.warn("[Feed API] Failed to parse Claude response for article:", article.title.slice(0, 50));
    }

    const importance = parseImportance(parsed.importance);
    const newtonSummary =
      typeof parsed.newtonSummary === "string" && parsed.newtonSummary.trim()
        ? parsed.newtonSummary.trim()
        : article.description;
    const noc = typeof parsed.noc === "string" && parsed.noc.trim() ? parsed.noc.trim() : null;
    const tag = typeof parsed.tag === "string" && parsed.tag.trim() ? parsed.tag.trim() : "Science";

    return {
      ...article,
      newtonSummary,
      importance,
      noc,
      tag,
    };
  } catch (err) {
    console.warn("[Feed API] Enrichment failed for article:", article.title.slice(0, 50), err);
    return {
      ...article,
      newtonSummary: article.description,
      importance: 3,
      noc: null,
      tag: article.sourceName,
    };
  }
}

function deduplicateByTitle(articles: RawArticle[]): RawArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    const key = a.title.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchNewsApi(newsApiKey: string): Promise<RawArticle[]> {
  const url =
    "https://newsapi.org/v2/everything?q=(artificial+intelligence+OR+science+OR+space+OR+biotech+OR+physics+OR+climate+technology)&sortBy=publishedAt&language=en&pageSize=20&apiKey=" +
    newsApiKey;

  const res = await fetch(url);
  const data = (await res.json()) as {
    status?: string;
    articles?: Array<{
      title?: string | null;
      description?: string | null;
      source?: { name?: string | null };
      url?: string | null;
      publishedAt?: string | null;
    }>;
    message?: string;
  };

  if (!res.ok) {
    throw new Error(data.message ?? "NewsAPI request failed");
  }

  return (data.articles ?? [])
    .filter((a) => Boolean(a.description?.trim()))
    .map((a) => ({
      title: (a.title ?? "").trim(),
      description: (a.description ?? "").trim(),
      sourceName: a.source?.name ?? "News",
      publishedAt: a.publishedAt ?? new Date().toISOString(),
      url: a.url ?? "",
    }))
    .filter((a) => a.title && a.url);
}

async function fetchHackerNews(): Promise<RawArticle[]> {
  const idsRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
  const ids = (await idsRes.json()) as number[];
  const top20 = ids.slice(0, 20);

  const items = await Promise.all(
    top20.map((id) =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) => r.json())
    )
  );

  const stories = items.filter(
    (item: { url?: string; score?: number; title?: string; type?: string }) =>
      item?.type === "story" && item?.url && (item?.score ?? 0) > 100 && item?.title
  );

  return stories.map((item: { title: string; url: string; time?: number }) => ({
    title: item.title.trim(),
    description: item.title.trim(),
    sourceName: "Hacker News",
    publishedAt: item.time ? new Date(item.time * 1000).toISOString() : new Date().toISOString(),
    url: item.url,
  }));
}

async function fetchArxiv(): Promise<RawArticle[]> {
  const url =
    "http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:physics+OR+cat:q-bio&sortBy=submittedDate&sortOrder=descending&max_results=10";
  const res = await fetch(url);
  const xml = await res.text();

  const entries: RawArticle[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];
    const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(entryXml);
    const summaryMatch = /<summary>([\s\S]*?)<\/summary>/.exec(entryXml);
    const linkMatch =
      /<link[^>]+href="([^"]+)"[^>]*rel="alternate"/.exec(entryXml) ??
      /rel="alternate"[^>]+href="([^"]+)"/.exec(entryXml);
    const publishedMatch = /<published>([^<]+)<\/published>/.exec(entryXml);

    const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const rawSummary = summaryMatch?.[1] ?? "";
    const summary = rawSummary
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const link = linkMatch?.[1] ?? "";
    const published = publishedMatch?.[1] ?? new Date().toISOString();

    if (title && link) {
      entries.push({
        title,
        description: summary || title,
        sourceName: "arXiv",
        publishedAt: published,
        url: link,
      });
    }
  }
  return entries;
}

async function fetchGitHubTrending(): Promise<RawArticle[]> {
  try {
    const res = await fetch("https://gh-trending-api.protest.eu/repositories?since=daily", {
      headers: { Accept: "application/json" },
    });
    const data = (await res.json()) as Array<{
      username?: string;
      repositoryName?: string;
      name?: string;
      description?: string;
      url?: string;
    }>;

    if (!Array.isArray(data)) return [];

    return data
      .filter((r) => r.repositoryName ?? r.name)
      .map((r) => {
        const name = (r.repositoryName ?? r.name ?? "").trim();
        const fullName = r.username ? `${r.username}/${name}` : name;
        return {
          title: fullName,
          description: (r.description ?? name).trim(),
          sourceName: "GitHub",
          publishedAt: new Date().toISOString(),
          url: r.url ?? `https://github.com/${fullName}`,
        };
      })
      .filter((a) => a.title && a.url);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const newsApiKey = process.env.NEWS_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const sources: Promise<RawArticle[]>[] = [];

    if (newsApiKey) {
      sources.push(fetchNewsApi(newsApiKey));
    }
    sources.push(fetchHackerNews());
    sources.push(fetchArxiv());
    sources.push(fetchGitHubTrending());

    const results = await Promise.allSettled(sources);
    const allRaw: RawArticle[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        allRaw.push(...result.value);
      }
    }

    const deduped = deduplicateByTitle(allRaw);

    const enriched = await Promise.all(deduped.map((a) => enrichArticle(a, anthropicKey)));

    enriched.sort((a, b) => b.importance - a.importance);

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[Feed API] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
