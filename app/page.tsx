"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type FeedArticle = {
  title: string;
  description: string;
  sourceName: string;
  publishedAt: string;
  url: string;
};

const IMPORTANCE_KEYWORDS = [
  "breakthrough",
  "first",
  "major",
  "launches",
  "releases",
  "critical",
  "emergency",
  "revolutionary",
];

function getImportanceScore(headline: string): number {
  const lower = headline.toLowerCase();
  const count = IMPORTANCE_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  return Math.min(5, Math.max(1, count + 1));
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function getTextContent(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(getTextContent).join("");
  if (children && typeof children === "object" && "props" in children) {
    return getTextContent((children as React.ReactElement).props.children);
  }
  return "";
}

function ResponseContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => {
          const text = getTextContent(children);
          if (text.trimStart().startsWith("⚡ NoC")) {
            return (
              <div className="mt-4 rounded-lg border border-[#e5e0da] bg-[#f5f2ee] px-4 py-3.5 first:mt-0">
                <p className="text-[15px] leading-relaxed text-[#171717] [&>strong]:font-bold [&>strong]:text-[#171717]">
                  {children}
                </p>
              </div>
            );
          }
          return <p className="mb-3 last:mb-0 text-[15px] leading-relaxed text-[#171717]">{children}</p>;
        },
        strong: ({ children }) => <strong className="font-semibold text-[#171717]">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="my-3 list-disc pl-5 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="my-3 list-decimal pl-5 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-[15px] leading-relaxed">{children}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

type Panel = "feed" | "newton";

export default function Home() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<Panel>("feed");
  const [feedArticles, setFeedArticles] = useState<FeedArticle[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/feed")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load feed");
        return res.json();
      })
      .then((data: FeedArticle[]) => setFeedArticles(data))
      .catch((err) => setFeedError(err instanceof Error ? err.message : "Failed to load feed"))
      .finally(() => setFeedLoading(false));
  }, []);

  const scrollToPanel = useCallback((panel: Panel) => {
    const el = scrollRef.current;
    if (!el) return;
    const index = panel === "feed" ? 0 : 1;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    setActivePanel(panel);
  }, []);

  async function submitQuery(query: string) {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const text = await res.text();
      let data: { error?: string; response?: string };
      try {
        data = JSON.parse(text);
      } catch {
        setError(
          res.status === 404
            ? "Chat API not found (404). Restart the dev server and try again."
            : `Server returned ${res.status}. ${text ? `Response: ${text.slice(0, 100)}` : ""}`
        );
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      setResponse(data.response ?? "");
      setMessage("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect";
      setError(msg.includes("fetch") || msg.includes("network") ? "Failed to connect. Check your network." : msg);
    } finally {
      setIsLoading(false);
    }
  }

  function handleGoDeeper(headline: string) {
    scrollToPanel("newton");
    const question = `Tell me more about ${headline} — and what's the non-obvious connection here?`;
    setMessage(question);
    submitQuery(question);
  }

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const width = el.clientWidth;
    const index = Math.round(scrollLeft / width);
    setActivePanel(index === 0 ? "feed" : "newton");
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuery(message);
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-white">
      <header className="flex shrink-0 flex-col items-center px-4 pt-12 pb-6 sm:px-6 sm:pb-8">
        {/* Logo */}
        <h1 className="mb-6 font-serif text-5xl font-normal tracking-tight text-[#171717] sm:mb-8 sm:text-6xl md:text-7xl">
          Newton
        </h1>

        {/* Tab switcher */}
        <div
          role="tablist"
          aria-label="Switch between Feed and Newton"
          className="flex gap-1"
        >
          <button
            role="tab"
            aria-selected={activePanel === "feed"}
            onClick={() => scrollToPanel("feed")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
              activePanel === "feed"
                ? "bg-[#171717] text-white"
                : "text-[#737373] hover:text-[#525252]"
            }`}
          >
            Feed
          </button>
          <button
            role="tab"
            aria-selected={activePanel === "newton"}
            onClick={() => scrollToPanel("newton")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
              activePanel === "newton"
                ? "bg-[#171717] text-white"
                : "text-[#737373] hover:text-[#525252]"
            }`}
          >
            Newton
          </button>
        </div>
      </header>

      {/* Swipeable panel container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex flex-1 overflow-x-auto overflow-y-auto snap-x snap-mandatory scroll-smooth px-4 pb-12 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Panel 1: Feed */}
        <section
          role="tabpanel"
          aria-label="Feed"
          className="flex min-w-full shrink-0 snap-start snap-always flex-col items-center pb-8"
        >
          <div className="flex w-full max-w-xl flex-col items-center gap-4 sm:gap-5">
            {feedLoading && (
              <div className="flex w-full items-center justify-center py-16">
                <div className="flex items-center gap-2 text-[#737373]">
                  <svg
                    className="h-5 w-5 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-sm">Loading feed...</span>
                </div>
              </div>
            )}
            {feedError && !feedLoading && (
              <p className="w-full py-8 text-center text-sm text-red-600">{feedError}</p>
            )}
            {!feedLoading && !feedError && feedArticles.length === 0 && (
              <p className="w-full py-8 text-center text-sm text-[#737373]">No articles to show.</p>
            )}
            {!feedLoading &&
              !feedError &&
              feedArticles.map((article, index) => {
                const importance = getImportanceScore(article.title);
                return (
                <article
                  key={article.url || index}
                  className="relative w-full rounded-lg border border-[#e8e8e8] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:px-6 sm:py-6"
                >
                  <div
                    className="absolute right-5 top-5 flex gap-0.5 sm:right-6 sm:top-6"
                    aria-label={`Importance: ${importance} of 5`}
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          i <= importance ? "bg-[#171717]" : "border border-[#d4d4d4] bg-transparent"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="mb-3 inline-block text-xs font-medium uppercase tracking-wider text-[#737373]">
                    {article.sourceName}
                  </span>
                  <h2 className="mb-2 font-serif text-xl font-normal leading-tight text-[#171717] sm:text-2xl">
                    {article.title}
                  </h2>
                  <p className="mb-4 text-[15px] leading-relaxed text-[#525252]">
                    {article.description}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleGoDeeper(article.title)}
                      className="rounded-full border border-[#171717] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#171717] hover:text-white"
                    >
                      Go deeper with Newton
                    </button>
                    <time className="text-xs text-[#a3a3a3]" dateTime={article.publishedAt}>
                      {formatRelativeTime(article.publishedAt)}
                    </time>
                  </div>
                </article>
              );
              })}
          </div>
        </section>

        {/* Panel 2: Newton (search + response) */}
        <section
          role="tabpanel"
          aria-label="Newton"
          className="flex min-w-full shrink-0 snap-start snap-always flex-col items-center pb-8"
        >
          <div className="flex w-full max-w-2xl flex-col items-center">
            <form onSubmit={handleSubmit} className="relative mb-10 w-full sm:mb-12">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask Newton anything..."
                disabled={isLoading}
                className="w-full rounded-full border border-[#e5e5e5] bg-white py-3.5 pl-5 pr-14 text-base text-[#171717] placeholder:text-[#737373] transition-colors focus:border-[#a3a3a3] focus:outline-none focus:ring-0 disabled:opacity-60 sm:py-4 sm:pl-6 sm:pr-16 sm:text-lg"
                aria-label="Search"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#171717] text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:right-3 sm:h-10 sm:w-10"
                aria-label="Send"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4 translate-x-0.5 sm:h-[18px] sm:w-[18px]"
                >
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </button>
            </form>

            <div className="w-full">
              {isLoading && (
                <div className="flex items-center gap-2 text-[#737373]">
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-sm">Thinking...</span>
                </div>
              )}
              {error && !isLoading && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              {response && !isLoading && (
                <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-5 py-4">
                  <ResponseContent content={response} />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
