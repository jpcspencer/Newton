import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type NewsApiArticle = {
  source?: { id?: string | null; name?: string | null };
  author?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  publishedAt?: string | null;
};

type CleanArticle = {
  title: string;
  description: string;
  sourceName: string;
  publishedAt: string;
  url: string;
};

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "NEWS_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const url =
      "https://newsapi.org/v2/everything?q=(artificial+intelligence+OR+science+OR+space+OR+biotech+OR+physics+OR+climate+technology)&sortBy=publishedAt&language=en&pageSize=20&apiKey=" +
      apiKey;

    const res = await fetch(url);

    const data = (await res.json()) as {
      status?: string;
      articles?: NewsApiArticle[];
      message?: string;
    };

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message ?? "NewsAPI request failed" },
        { status: res.status }
      );
    }

    const articles = data.articles ?? [];
    const seenTitles = new Set<string>();
    const cleaned: CleanArticle[] = articles
      .filter((a): a is NewsApiArticle & { description: string } => {
        return Boolean(a.description?.trim());
      })
      .map((a) => ({
        title: a.title ?? "",
        description: a.description ?? "",
        sourceName: a.source?.name ?? "Unknown",
        publishedAt: a.publishedAt ?? "",
        url: a.url ?? "",
      }))
      .filter((a) => {
        const normalized = a.title.trim().toLowerCase();
        if (seenTitles.has(normalized)) return false;
        seenTitles.add(normalized);
        return true;
      });

    return NextResponse.json(cleaned);
  } catch (error) {
    console.error("[Feed API] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
