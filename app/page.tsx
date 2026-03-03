"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type FeedArticle = {
  title: string;
  newtonSummary: string;
  sourceName: string;
  publishedAt: string;
  url: string;
  importance: number;
  noc: string | null;
  tag: string;
};

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

function ResponseContent({ content, isDark }: { content: string; isDark: boolean }) {
  const textCls = isDark ? "text-[#ededed]" : "text-[#171717]";
  const highlightCls = isDark
    ? "border-[#404040] bg-[#262626]"
    : "border-[#e5e0da] bg-[#f5f2ee]";
  const strongCls = isDark ? "font-semibold text-[#ededed]" : "font-semibold text-[#171717]";
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => {
          const text = getTextContent(children);
          if (text.trimStart().startsWith("⚡ NoC")) {
            return (
              <div className={`mt-4 rounded-lg border px-4 py-3.5 first:mt-0 ${highlightCls}`}>
                <p className={`text-[15px] leading-relaxed [&>strong]:font-bold ${textCls}`}>
                  {children}
                </p>
              </div>
            );
          }
          return <p className={`mb-3 last:mb-0 text-[15px] leading-relaxed ${textCls}`}>{children}</p>;
        },
        strong: ({ children }) => <strong className={strongCls}>{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="my-3 list-disc pl-5 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="my-3 list-decimal pl-5 space-y-1">{children}</ol>,
        li: ({ children }) => <li className={`text-[15px] leading-relaxed ${textCls}`}>{children}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

type Panel = "feed" | "newton";
type CardSize = "compact" | "default" | "comfortable";
type FeedView = "card" | "list";

const THEME_STORAGE_KEY = "newton-theme";

const CARD_SIZE_ORDER: CardSize[] = ["compact", "default", "comfortable"];

export default function Home() {
  const [isDark, setIsDark] = useState(false);
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<Panel>("feed");
  const [feedArticles, setFeedArticles] = useState<FeedArticle[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [cardSize, setCardSize] = useState<CardSize>("default");
  const [feedView, setFeedView] = useState<FeedView>("card");
  const [expandedArticle, setExpandedArticle] = useState<FeedArticle | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function cycleCardSize() {
    setCardSize((prev) => CARD_SIZE_ORDER[(CARD_SIZE_ORDER.indexOf(prev) + 1) % CARD_SIZE_ORDER.length]);
  }

  function toggleFeedView() {
    setFeedView((prev) => (prev === "card" ? "list" : "card"));
  }

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    setIsDark(stored === "dark");
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedArticle(null);
    };
    if (expandedArticle) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [expandedArticle]);

  const fetchFeed = useCallback(() => {
    setFeedLoading(true);
    setFeedError(null);
    fetch("/api/feed")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load feed");
        return res.json();
      })
      .then((data: FeedArticle[]) => {
        const seen = new Set<string>();
        const deduped = data.filter((a) => {
          const key = a.title.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setFeedArticles(deduped);
      })
      .catch((err) => setFeedError(err instanceof Error ? err.message : "Failed to load feed"))
      .finally(() => setFeedLoading(false));
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    const interval = setInterval(fetchFeed, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
  }

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
    <div
      className={`flex min-h-screen w-full flex-col transition-colors duration-200 ${
        isDark ? "bg-[#0a0a0a]" : "bg-white"
      }`}
    >
      {/* Article expansion modal */}
      {expandedArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className="absolute inset-0 bg-black/40 animate-[overlay-fade-in_0.15s_ease-out]"
            onClick={() => setExpandedArticle(null)}
            aria-hidden="true"
          />
          <div
            className={`relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border shadow-xl animate-[modal-fade-in_0.2s_ease-out] ${
              isDark ? "border-[#404040] bg-[#171717]" : "border-[#e8e8e8] bg-white"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpandedArticle(null)}
              aria-label="Close"
              className={`absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:opacity-70 ${
                isDark ? "text-[#a3a3a3] hover:text-[#ededed]" : "text-[#737373] hover:text-[#525252]"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <div className="px-6 py-6 pr-14 sm:px-8 sm:py-8 sm:pr-16">
              <span className={`mb-2 inline-block text-xs font-medium uppercase tracking-wider ${isDark ? "text-[#a3a3a3]" : "text-[#737373]"}`}>
                {expandedArticle.tag}
              </span>
              <h2 id="modal-title" className={`mb-2 font-serif text-2xl font-normal leading-tight sm:text-3xl ${isDark ? "text-[#ededed]" : "text-[#171717]"}`}>
                {expandedArticle.title}
              </h2>
              <div className="mb-4 flex items-center gap-3">
                <time className={`text-xs ${isDark ? "text-[#737373]" : "text-[#a3a3a3]"}`} dateTime={expandedArticle.publishedAt}>
                  {formatRelativeTime(expandedArticle.publishedAt)}
                </time>
                <div className="flex gap-0.5" aria-label={`Importance: ${expandedArticle.importance} of 5`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        i <= expandedArticle.importance
                          ? isDark
                            ? "bg-[#ededed]"
                            : "bg-[#171717]"
                          : isDark
                            ? "border border-[#404040] bg-transparent"
                            : "border border-[#d4d4d4] bg-transparent"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className={`mb-6 text-[15px] leading-relaxed ${isDark ? "text-[#a3a3a3]" : "text-[#525252]"}`}>
                {expandedArticle.newtonSummary}
              </p>
              {expandedArticle.noc && (
                <div
                  className={`mb-6 rounded-lg border px-4 py-3.5 ${
                    isDark ? "border-[#404040] bg-[#262626]" : "border-[#e5e0da] bg-[#f5f2ee]"
                  }`}
                >
                  <p className={`text-[15px] leading-relaxed ${isDark ? "text-[#ededed]" : "text-[#171717]"}`}>
                    <span className="font-semibold">⚡ NoC: </span>
                    {expandedArticle.noc}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => handleGoDeeper(expandedArticle.title)}
                  className={`w-fit rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    isDark
                      ? "border-[#ededed] bg-transparent text-[#ededed] hover:bg-[#ededed] hover:text-[#171717]"
                      : "border-[#171717] bg-white text-[#171717] hover:bg-[#171717] hover:text-white"
                  }`}
                >
                  Go deeper with Newton
                </button>
                <a
                  href={expandedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    isDark ? "text-[#a3a3a3] hover:text-[#ededed]" : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  Read original article
                  <span aria-hidden>→</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dark mode toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`fixed right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#a3a3a3] focus:ring-offset-2 ${
          isDark
            ? "text-[#a3a3a3] hover:text-[#ededed] focus:ring-offset-[#0a0a0a]"
            : "text-[#737373] hover:text-[#525252] focus:ring-offset-white"
        }`}
      >
        {isDark ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      <header className="flex shrink-0 flex-col items-center px-4 pt-12 pb-6 sm:px-6 sm:pb-8">
        {/* Logo */}
        <h1
          className={`mb-6 font-serif text-5xl font-normal tracking-tight sm:mb-8 sm:text-6xl md:text-7xl ${
            isDark ? "text-[#ededed]" : "text-[#171717]"
          }`}
        >
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
                : isDark
                  ? "text-[#a3a3a3] hover:text-[#ededed]"
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
                : isDark
                  ? "text-[#a3a3a3] hover:text-[#ededed]"
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
            <div className="flex w-full items-center justify-end gap-0.5">
              <button
                type="button"
                onClick={cycleCardSize}
                title={`Card size: ${cardSize.charAt(0).toUpperCase() + cardSize.slice(1)}`}
                aria-label={`Card size: ${cardSize}`}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:opacity-80 focus:outline-none focus:ring-0 ${
                  isDark
                    ? "text-[#a3a3a3] hover:text-[#ededed]"
                    : "text-[#737373] hover:text-[#525252]"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={toggleFeedView}
                title={feedView === "card" ? "Switch to list view" : "Switch to card view"}
                aria-label={feedView === "card" ? "Switch to list view" : "Switch to card view"}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:opacity-80 focus:outline-none focus:ring-0 ${
                  isDark
                    ? "text-[#a3a3a3] hover:text-[#ededed]"
                    : "text-[#737373] hover:text-[#525252]"
                }`}
              >
                {feedView === "card" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <line x1="8" x2="21" y1="6" y2="6" />
                    <line x1="8" x2="21" y1="12" y2="12" />
                    <line x1="8" x2="21" y1="18" y2="18" />
                    <line x1="3" x2="3.01" y1="6" y2="6" />
                    <line x1="3" x2="3.01" y1="12" y2="12" />
                    <line x1="3" x2="3.01" y1="18" y2="18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <rect width="7" height="7" x="3" y="3" rx="1" />
                    <rect width="7" height="7" x="14" y="3" rx="1" />
                    <rect width="7" height="7" x="14" y="14" rx="1" />
                    <rect width="7" height="7" x="3" y="14" rx="1" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={fetchFeed}
                disabled={feedLoading}
                title="Refresh feed"
                aria-label="Refresh feed"
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:opacity-80 focus:outline-none focus:ring-0 disabled:opacity-50 ${
                  isDark
                    ? "text-[#a3a3a3] hover:text-[#ededed]"
                    : "text-[#737373] hover:text-[#525252]"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-4 w-4 ${feedLoading ? "animate-spin" : ""}`}
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 21h5v-5" />
                </svg>
              </button>
            </div>
            {feedLoading && feedArticles.length === 0 && (
              <div className="flex w-full items-center justify-center py-16">
                <div className={`flex items-center gap-2 ${isDark ? "text-[#a3a3a3]" : "text-[#737373]"}`}>
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
              <p className={`w-full py-8 text-center text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>{feedError}</p>
            )}
            {!feedError && feedArticles.length === 0 && !feedLoading && (
              <p className={`w-full py-8 text-center text-sm ${isDark ? "text-[#a3a3a3]" : "text-[#737373]"}`}>No articles to show.</p>
            )}
            {!feedError && feedView === "list" && (
              <div
                className={`w-full rounded-lg border ${
                  isDark ? "border-[#262626] bg-[#171717]" : "border-[#e8e8e8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                }`}
              >
                {feedArticles.map((article, index) => {
                  const mutedCls = isDark ? "text-[#a3a3a3]" : "text-[#737373]";
                  const textCls = isDark ? "text-[#ededed]" : "text-[#171717]";
                  return (
                    <button
                      key={article.url || index}
                      type="button"
                      onClick={() => handleGoDeeper(article.title)}
                      className={`flex w-full items-center gap-3 border-b px-4 py-2.5 text-left transition-colors first:rounded-t-lg last:border-b-0 last:rounded-b-lg ${
                        isDark ? "border-[#262626] hover:bg-[#262626]" : "border-[#e8e8e8] hover:bg-[#fafafa]"
                      }`}
                    >
                      <span className={`shrink-0 text-xs font-medium uppercase tracking-wider ${mutedCls}`} style={{ minWidth: "4.5rem" }}>
                        {article.tag}
                      </span>
                      <span className={`min-w-0 flex-1 truncate font-serif text-sm ${textCls}`}>
                        {article.title}
                      </span>
                      <div className="flex shrink-0 gap-0.5" aria-hidden>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span
                            key={i}
                            className={`h-1 w-1 shrink-0 rounded-full ${
                              i <= article.importance
                                ? isDark
                                  ? "bg-[#ededed]"
                                  : "bg-[#171717]"
                                : isDark
                                  ? "border border-[#404040] bg-transparent"
                                  : "border border-[#d4d4d4] bg-transparent"
                            }`}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {!feedError &&
              feedView === "card" &&
              feedArticles.map((article, index) => {
                const mutedCls = isDark ? "text-[#a3a3a3]" : "text-[#737373]";
                const textCls = isDark ? "text-[#ededed]" : "text-[#171717]";
                const borderCls = isDark
                  ? "border-[#262626] bg-[#171717] hover:border-[#404040]"
                  : "border-[#e8e8e8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]";

                const isCompact = cardSize === "compact";
                const importance = article.importance;
                const isComfortable = cardSize === "comfortable";

                return (
                  <article
                    key={article.url || index}
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedArticle(article)}
                    onKeyDown={(e) => e.key === "Enter" && setExpandedArticle(article)}
                    className={`relative w-full cursor-pointer rounded-lg border transition-shadow ${borderCls} ${
                      isCompact ? "px-4 py-3 sm:px-4 sm:py-3" : isComfortable ? "px-6 py-6 sm:px-8 sm:py-7" : "px-5 py-5 sm:px-6 sm:py-6"
                    }`}
                  >
                    <div
                      className={`absolute flex gap-0.5 ${isCompact ? "right-4 top-3" : isComfortable ? "right-6 top-6 sm:right-8 sm:top-7" : "right-5 top-5 sm:right-6 sm:top-6"}`}
                      aria-label={`Importance: ${importance} of 5`}
                    >
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span
                          key={i}
                          className={`shrink-0 rounded-full ${
                            isCompact ? "h-1 w-1" : "h-1.5 w-1.5"
                          } ${
                            i <= importance
                              ? isDark
                                ? "bg-[#ededed]"
                                : "bg-[#171717]"
                              : isDark
                                ? "border border-[#404040] bg-transparent"
                                : "border border-[#d4d4d4] bg-transparent"
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`inline-block text-xs font-medium uppercase tracking-wider ${mutedCls} ${isCompact ? "mb-1" : isComfortable ? "mb-4" : "mb-3"}`}>
                      {article.tag}
                    </span>
                    <h2
                      className={`font-serif font-normal leading-tight ${textCls} ${
                        isCompact
                          ? "text-base sm:text-lg"
                          : isComfortable
                            ? "text-2xl sm:text-3xl mb-3"
                            : "mb-2 text-xl sm:text-2xl"
                      }`}
                    >
                      {article.title}
                    </h2>
                    {!isCompact && (
                      <p className={`leading-relaxed ${isDark ? "text-[#a3a3a3]" : "text-[#525252]"} ${isComfortable ? "mb-5 text-[17px]" : "mb-4 text-[15px]"}`}>
                        {article.newtonSummary}
                      </p>
                    )}
                    {!isCompact && (
                      <div className={`flex flex-wrap items-center justify-between gap-3 ${isComfortable ? "mt-1" : ""}`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGoDeeper(article.title);
                          }}
                          className={`rounded-full border px-4 py-2 font-medium transition-colors ${
                            isComfortable ? "text-base" : "text-sm"
                          } ${
                            isDark
                              ? "border-[#ededed] bg-transparent text-[#ededed] hover:bg-[#ededed] hover:text-[#171717]"
                              : "border-[#171717] bg-white text-[#171717] hover:bg-[#171717] hover:text-white"
                          }`}
                        >
                          Go deeper with Newton
                        </button>
                        <time className={`text-xs ${isDark ? "text-[#737373]" : "text-[#a3a3a3]"}`} dateTime={article.publishedAt}>
                          {formatRelativeTime(article.publishedAt)}
                        </time>
                      </div>
                    )}
                    {isCompact && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGoDeeper(article.title);
                        }}
                        className={`mt-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          isDark
                            ? "border-[#ededed] bg-transparent text-[#ededed] hover:bg-[#ededed] hover:text-[#171717]"
                            : "border-[#171717] bg-white text-[#171717] hover:bg-[#171717] hover:text-white"
                        }`}
                      >
                        Go deeper with Newton
                      </button>
                    )}
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
                className={`w-full rounded-full border py-3.5 pl-5 pr-14 text-base transition-colors focus:outline-none focus:ring-0 disabled:opacity-60 sm:py-4 sm:pl-6 sm:pr-16 sm:text-lg ${
                  isDark
                    ? "border-[#404040] bg-[#171717] text-[#ededed] placeholder:text-[#737373] focus:border-[#737373]"
                    : "border-[#e5e5e5] bg-white text-[#171717] placeholder:text-[#737373] focus:border-[#a3a3a3]"
                }`}
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
                <div className={`flex items-center gap-2 ${isDark ? "text-[#a3a3a3]" : "text-[#737373]"}`}>
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
                <p className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>{error}</p>
              )}
              {response && !isLoading && (
                <div
                  className={`rounded-lg border px-5 py-4 ${
                    isDark ? "border-[#404040] bg-[#171717]" : "border-[#e5e5e5] bg-[#fafafa]"
                  }`}
                >
                  <ResponseContent content={response} isDark={isDark} />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
