import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type ArticleSource = "news" | "hackernews" | "arxiv" | "github" | "reddit";

type RawArticle = {
  title: string;
  description: string;
  source: ArticleSource;
  sourceName: string;
  publishedAt: string;
  url: string;
  urlToImage?: string | null;
  importanceHint?: string;
};

type EnrichedArticle = {
  title: string;
  keplerSummary: string;
  source: ArticleSource;
  sourceName: string;
  publishedAt: string;
  url: string;
  urlToImage?: string | null;
  importance: number;
  keplersInsight: string | null;
  tag: string;
};

type ClaudeEnrichment = {
  keplerSummary?: string;
  importance?: number;
  keplersInsight?: string | null;
  tag?: string;
};

const ENRICHMENT_SYSTEM_BASE =
  "You are Kepler, a warm and curious AI research companion. You interpret science and technology news with intelligence and clarity. Always respond in valid JSON only, no markdown, no backticks. The importance field MUST be a number between 1 and 5.";

const ENRICHMENT_USER_TEMPLATE = `Enrich this article for the Kurrnt feed. Return a JSON object with these fields:
- keplerSummary: a 2-3 sentence summary in Kepler's voice — clear, intelligent, no jargon, written for a curious non-expert
- importance: a number 1-5 (integer) based on genuine significance to science and technology — must be a number, not a string
- keplersInsight: one sentence describing Kepler's insight — a connection between this story and something from a different field that most people wouldn't put together. Only include if genuinely interesting, otherwise return null
- tag: one word category tag like "AI", "Space", "Biotech", "Physics", "Climate"

Article title: {title}
Article description: {description}
{importanceHint}
{interestsHint}`;

type CachedEnrichment = {
  kepler_summary: string | null;
  importance_score: number;
  kepler_insight: string | null;
  tag: string | null;
  created_at: string;
};

async function getCachedEnrichment(url: string): Promise<CachedEnrichment | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("article_cache")
      .select("kepler_summary, importance_score, kepler_insight, tag, created_at")
      .eq("url", url)
      .single();

    if (error || !data) return null;

    const createdAt = new Date(data.created_at).getTime();
    if (Date.now() - createdAt > CACHE_TTL_MS) return null;

    return data as CachedEnrichment;
  } catch {
    return null;
  }
}

async function saveToCache(
  url: string,
  title: string,
  enrichment: { keplerSummary: string; importance: number; keplersInsight: string | null; tag: string }
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("article_cache").upsert(
      {
        url,
        title,
        kepler_insight: enrichment.keplersInsight,
        importance_score: enrichment.importance,
        kepler_summary: enrichment.keplerSummary,
        tag: enrichment.tag,
        created_at: new Date().toISOString(),
      },
      { onConflict: "url" }
    );
  } catch (err) {
    console.warn("[Feed API] Failed to save to cache:", err);
  }
}

function parseImportance(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.min(5, Math.max(1, Math.round(value)));
  }
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (!Number.isNaN(n)) {
      return Math.min(5, Math.max(1, Math.round(n)));
    }
  }
  return null;
}

async function enrichArticle(
  article: RawArticle,
  anthropicKey: string,
  userInterests?: string[]
): Promise<EnrichedArticle> {
  const cached = await getCachedEnrichment(article.url);
  if (cached) {
    return {
      ...article,
      keplerSummary: cached.kepler_summary ?? article.description,
      importance: Math.min(5, Math.max(1, cached.importance_score)),
      keplersInsight: cached.kepler_insight ?? null,
      tag: cached.tag ?? article.sourceName,
      source: article.source,
      sourceName: article.sourceName,
    };
  }

  const hintLine = article.importanceHint
    ? `Suggested importance based on source metrics: ${article.importanceHint}. You may adjust based on content significance.`
    : "";
  const interestsHint =
    userInterests && userInterests.length > 0
      ? `\nThe user is particularly interested in: ${userInterests.join(", ")}. When generating keplersInsight, emphasize connections and insights relevant to these areas when genuinely applicable. Do not force connections — only when the link is meaningful.`
      : "";
  const userPrompt = ENRICHMENT_USER_TEMPLATE.replace("{title}", article.title)
    .replace("{description}", article.description)
    .replace("{importanceHint}", hintLine)
    .replace("{interestsHint}", interestsHint);

  const systemPrompt =
    userInterests && userInterests.length > 0
      ? `${ENRICHMENT_SYSTEM_BASE} When the article relates to the user's interests (${userInterests.join(", ")}), prioritize insights that connect to those areas.`
      : ENRICHMENT_SYSTEM_BASE;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: systemPrompt,
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

    const parsedImportance = parseImportance(parsed.importance);
    const importance = parsedImportance !== null ? parsedImportance : 3;
    const keplerSummary =
      typeof parsed.keplerSummary === "string" && parsed.keplerSummary.trim()
        ? parsed.keplerSummary.trim()
        : article.description;
    const keplersInsight = (typeof parsed.keplersInsight === "string" && parsed.keplersInsight.trim()
      ? parsed.keplersInsight.trim()
      : typeof (parsed as { noc?: string }).noc === "string" && (parsed as { noc?: string }).noc?.trim()
        ? (parsed as { noc?: string }).noc!.trim()
        : null);
    const tag = typeof parsed.tag === "string" && parsed.tag.trim() ? parsed.tag.trim() : "Science";

    const enriched: EnrichedArticle = {
      ...article,
      keplerSummary,
      importance,
      keplersInsight,
      tag,
      source: article.source,
      sourceName: article.sourceName,
    };

    saveToCache(article.url, article.title, {
      keplerSummary,
      importance,
      keplersInsight,
      tag,
    }).catch(() => {});

    return enriched;
  } catch (err) {
    console.warn("[Feed API] Enrichment failed for article:", article.title.slice(0, 50), err);
    return {
      ...article,
      keplerSummary: article.description,
      importance: 3,
      keplersInsight: null,
      tag: article.sourceName,
      source: article.source,
      sourceName: article.sourceName,
    };
  }
}

function normalizeTitleForDedup(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "") // remove punctuation, keep letters and numbers
    .replace(/\s+/g, " ")
    .trim();
}

function deduplicateByUrl(articles: RawArticle[]): RawArticle[] {
  const seenUrls = new Set<string>();
  return articles.filter((a) => {
    const url = a.url?.trim().toLowerCase() ?? "";
    if (!url || seenUrls.has(url)) return false;
    seenUrls.add(url);
    return true;
  });
}

function deduplicateByTitle(articles: RawArticle[]): RawArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    const key = normalizeTitleForDedup(a.title);
    if (!key || seen.has(key)) return false;
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
      urlToImage?: string | null;
      publishedAt?: string | null;
    }>;
    message?: string;
  };

  if (!res.ok) {
    throw new Error(data.message ?? "NewsAPI request failed");
  }

  return (data.articles ?? [])
    .filter((a) => Boolean(a.description?.trim()))
    .map((a) => {
      let sourceName = "News";
      if (a.source && typeof a.source === "object" && typeof (a.source as { name?: string }).name === "string") {
        const name = ((a.source as { name?: string }).name ?? "").trim();
        if (name) sourceName = name;
      }
      return {
        title: (a.title ?? "").trim(),
        description: (a.description ?? "").trim(),
        source: "news" as const,
        sourceName,
        publishedAt: a.publishedAt ?? new Date().toISOString(),
        url: a.url ?? "",
        urlToImage: a.urlToImage ?? null,
      };
    })
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

  return stories.map(
    (item: {
      title: string;
      url: string;
      time?: number;
      score?: number;
      descendants?: number;
      kids?: unknown[];
    }) => {
      const score = item.score ?? 0;
      const comments = item.descendants ?? item.kids?.length ?? 0;
      let hintImportance = 1;
      if (score >= 500 && comments >= 100) hintImportance = 5;
      else if (score >= 300) hintImportance = 4;
      else if (score >= 150) hintImportance = 3;
      else if (score >= 75) hintImportance = 2;
      return {
        title: item.title.trim(),
        description: item.title.trim(),
        source: "hackernews" as const,
        sourceName: "Hacker News",
        publishedAt: item.time ? new Date(item.time * 1000).toISOString() : new Date().toISOString(),
        url: item.url,
        importanceHint: `${hintImportance} (score: ${score}, comments: ${comments})`,
      };
    }
  );
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
        source: "arxiv" as const,
        sourceName: "arXiv",
        publishedAt: published,
        url: link,
        importanceHint: "3 (academic paper — adjust based on content significance)",
      });
    }
  }
  return entries;
}

const REDDIT_SUBREDDITS = [
  "artificial",
  "MachineLearning",
  "technology",
  "Futurology",
  "singularity",
  "space",
  "Physics",
  "neuroscience",
  "Biotech",
  "QuantumComputing",
  "cybersecurity",
  "climatescience",
  "robotics",
];

const REDDIT_USER_AGENT = "Kurrnt/1.0 (kurrnt.app)";

async function fetchReddit(): Promise<RawArticle[]> {
  const allArticles: RawArticle[] = [];

  for (const subreddit of REDDIT_SUBREDDITS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=5`, {
        headers: { "User-Agent": REDDIT_USER_AGENT },
      });
      const data = (await res.json()) as {
        data?: {
          children?: Array<{
            data?: {
              title?: string;
              url?: string;
              permalink?: string;
              selftext?: string;
              created_utc?: number;
              thumbnail?: string;
            };
          }>;
        };
      };

      const children = data?.data?.children ?? [];
      for (const child of children) {
        const post = child?.data;
        if (!post?.title) continue;

        const url = post.url ?? "";
        const permalink = post.permalink ?? "";
        const selftext = (post.selftext ?? "").trim();

        // Filter out low-quality text-only posts: reddit.com/r/ url with empty selftext
        if (url.includes("reddit.com/r/") && !selftext) continue;

        const finalUrl = url && !url.includes("reddit.com/r/") ? url : `https://reddit.com${permalink.startsWith("/") ? "" : "/"}${permalink}`;
        const description = selftext ? selftext.slice(0, 200) + (selftext.length > 200 ? "…" : "") : post.title;
        const thumbnail = post.thumbnail;
        const urlToImage = typeof thumbnail === "string" && thumbnail.startsWith("https") ? thumbnail : null;

        allArticles.push({
          title: post.title.trim(),
          description,
          source: "reddit" as const,
          sourceName: `Reddit · r/${subreddit}`,
          publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString(),
          url: finalUrl,
          urlToImage,
        });
      }
    } catch (err) {
      console.warn(`[Feed API] Reddit fetch failed for r/${subreddit}:`, err);
    }
  }

  return allArticles.filter((a) => a.title && a.url);
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
      totalStars?: number;
      stars?: number;
    }>;

    if (!Array.isArray(data)) return [];

    return data
      .filter((r) => r.repositoryName ?? r.name)
      .map((r) => {
        const name = (r.repositoryName ?? r.name ?? "").trim();
        const fullName = r.username ? `${r.username}/${name}` : name;
        const stars = r.totalStars ?? r.stars ?? 0;
        let hintImportance = 1;
        if (stars >= 10000) hintImportance = 5;
        else if (stars >= 5000) hintImportance = 4;
        else if (stars >= 1000) hintImportance = 3;
        else if (stars >= 500) hintImportance = 2;
        return {
          title: fullName,
          description: (r.description ?? name).trim(),
          source: "github" as const,
          sourceName: "GitHub",
          publishedAt: new Date().toISOString(),
          url: r.url ?? `https://github.com/${fullName}`,
          importanceHint: `${hintImportance} (${stars} stars)`,
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

    let userInterests: string[] | undefined;
    try {
      const supabase = await createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const interests = session?.user?.user_metadata?.interests;
      if (Array.isArray(interests) && interests.length > 0) {
        userInterests = interests.filter((i): i is string => typeof i === "string");
      }
    } catch {
      // Fall back to default — no personalization
    }

    const sources: Promise<RawArticle[]>[] = [];

    if (newsApiKey) {
      sources.push(fetchNewsApi(newsApiKey));
    }
    sources.push(fetchHackerNews());
    sources.push(fetchArxiv());
    sources.push(fetchGitHubTrending());
    sources.push(fetchReddit());

    const results = await Promise.allSettled(sources);
    const allRaw: RawArticle[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        allRaw.push(...result.value);
      }
    }

    const dedupedByUrl = deduplicateByUrl(allRaw);
    const deduped = deduplicateByTitle(dedupedByUrl);

    const withEnoughDescription = deduped.filter((a) => {
      const desc = a.description?.trim() ?? "";
      return desc.length >= 50;
    });

    const enriched = await Promise.all(
      withEnoughDescription.map((a) => enrichArticle(a, anthropicKey, userInterests))
    );

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
