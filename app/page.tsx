"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";

type FeedArticle = {
  title: string;
  newtonSummary: string;
  source?: "news" | "hackernews" | "arxiv" | "github";
  sourceName: string;
  publishedAt: string;
  url: string;
  importance: number;
  noc: string | null;
  tag: string;
};

function getSourceDisplay(article: FeedArticle): string {
  if (article.sourceName?.trim()) return article.sourceName.trim();
  switch (article.source) {
    case "news":
      return "News";
    case "hackernews":
      return "Hacker News";
    case "arxiv":
      return "arXiv";
    case "github":
      return "GitHub";
    default:
      return "Unknown";
  }
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
    const el = children as React.ReactElement<{ children?: React.ReactNode }>;
    return getTextContent(el.props.children ?? "");
  }
  return "";
}

function ResponseContent({ content, isDark }: { content: string; isDark: boolean }) {
  const textCls = isDark ? "text-[#edebe8]" : "text-[#1a1a1a]";
  const highlightCls = isDark
    ? "bg-[#1c1c1b] shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
    : "bg-[#ffffff] shadow-[0_1px_3px_rgba(0,0,0,0.06)]";
  const strongCls = isDark ? "font-semibold text-[#edebe8]" : "font-semibold text-[#1a1a1a]";
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => {
          const text = getTextContent(children);
          if (text.trimStart().startsWith("⚡ NoC")) {
            return (
              <div className={`mt-4 rounded-lg px-4 py-3.5 first:mt-0 ${highlightCls}`}>
                <p className={`text-sm leading-relaxed [&>strong]:font-bold ${textCls}`}>
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
        li: ({ children }) => <li className={`text-sm leading-relaxed ${textCls}`}>{children}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

type Panel = "feed" | "newton";
type CardSize = "compact" | "default" | "comfortable";
type FeedView = "card" | "list";
type FeedSort = "importance" | "newest" | "source";

const SOURCE_ORDER = ["Hacker News", "arXiv", "GitHub", "News"];

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
  const [feedSort, setFeedSort] = useState<FeedSort>("importance");
  const [expandedArticle, setExpandedArticle] = useState<FeedArticle | null>(null);
  const [newStories, setNewStories] = useState<FeedArticle[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const feedArticlesRef = useRef<FeedArticle[]>([]);
  feedArticlesRef.current = feedArticles;

  const sortedArticles = useMemo(() => {
    const arr = [...feedArticles];
    if (feedSort === "importance") {
      arr.sort((a, b) => b.importance - a.importance);
    } else if (feedSort === "newest") {
      arr.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    } else {
      const sourceRank = (s: string) => {
        const i = SOURCE_ORDER.indexOf(s);
        return i >= 0 ? i : SOURCE_ORDER.length; // Unknown sources last
      };
      arr.sort((a, b) => {
        const ra = sourceRank(getSourceDisplay(a));
        const rb = sourceRank(getSourceDisplay(b));
        if (ra !== rb) return ra - rb;
        return b.importance - a.importance;
      });
    }
    return arr;
  }, [feedArticles, feedSort]);

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
        setNewStories([]);
      })
      .catch((err) => setFeedError(err instanceof Error ? err.message : "Failed to load feed"))
      .finally(() => setFeedLoading(false));
  }, []);

  useEffect(() => {
    fetchFeed();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: fetch once on mount

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/feed")
        .then((res) => res.ok ? res.json() : Promise.reject(new Error("Failed")))
        .then((data: FeedArticle[]) => {
          const seen = new Set<string>();
          const deduped = data.filter((a) => {
            const key = a.title.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          const currentTitles = new Set(feedArticlesRef.current.map((a) => a.title.trim().toLowerCase()));
          const fresh = deduped.filter((a) => !currentTitles.has(a.title.trim().toLowerCase()));
          if (fresh.length > 0) {
            setNewStories((prev) => {
              const prevTitles = new Set(prev.map((a) => a.title.trim().toLowerCase()));
              const brandNew = fresh.filter((a) => !prevTitles.has(a.title.trim().toLowerCase()));
              return [...brandNew, ...prev];
            });
          }
        })
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setSortDropdownOpen(false);
      }
    };
    if (sortDropdownOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [sortDropdownOpen]);


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
    const scrollTop = el.scrollTop;
    const width = el.clientWidth;
    const index = Math.round(scrollLeft / width);
    setActivePanel(index === 0 ? "feed" : "newton");
    setShowBackToTop(scrollTop >= 300);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuery(message);
  }

  return (
    <div
      className={`flex min-h-screen w-full flex-col transition-colors duration-200 ${
        isDark ? "bg-[#111110]" : "bg-[#f8f7f5]"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[680px] flex-1 flex-col">
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
            className={`relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.12)] animate-[modal-fade-in_0.2s_ease-out] ${
              isDark ? "bg-[#1c1c1b]" : "bg-[#ffffff] shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpandedArticle(null)}
              aria-label="Close"
              className={`absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:opacity-70 ${
                isDark ? "text-[#888886] hover:text-[#edebe8]" : "text-[#6b6b6b] hover:text-[#1a1a1a]"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <div className="px-6 py-6 pr-14 sm:px-8 sm:py-8 sm:pr-16">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`text-xs font-medium uppercase tracking-[0.15em] ${isDark ? "text-[#888886]" : "text-[#888888]"}`}>
                  {expandedArticle.tag}
                </span>
                <div className="flex gap-0.5" aria-label={`Importance: ${expandedArticle.importance} of 5`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={`h-1 w-1 shrink-0 rounded-full ${
                        i <= expandedArticle.importance
                          ? isDark
                            ? "bg-[#edebe8]"
                            : "bg-[#1a1a1a]"
                          : isDark
                            ? "border border-[#3a3a39] bg-transparent"
                            : "border border-[#d4d4d4] bg-transparent"
                      }`}
                    />
                  ))}
                </div>
                <time className={`text-xs ${isDark ? "text-[#888886]" : "text-[#6b6b6b]"}`} dateTime={expandedArticle.publishedAt}>
                  {formatRelativeTime(expandedArticle.publishedAt)}
                </time>
              </div>
              <h2 id="modal-title" className={`mb-2 font-serif text-xl font-medium leading-tight sm:text-2xl ${isDark ? "text-[#edebe8]" : "text-[#1a1a1a]"}`}>
                {expandedArticle.title}
              </h2>
              <p className={`mb-6 text-sm leading-relaxed ${isDark ? "text-[#888886]" : "text-[#6b6b6b]"}`}>
                {expandedArticle.newtonSummary}
              </p>
              {expandedArticle.noc && (
                <div
                  className={`mb-6 rounded-lg px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
                    isDark ? "bg-[#1c1c1b]" : "bg-[#ffffff]"
                  }`}
                >
                  <p className={`text-sm leading-relaxed ${isDark ? "text-[#edebe8]" : "text-[#1a1a1a]"}`}>
                    <span className="font-semibold">⚡ NoC: </span>
                    {expandedArticle.noc}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      label: "What does this mean?",
                      question: `Explain this story in simple terms and why it matters: "${expandedArticle.title}" — ${expandedArticle.newtonSummary}`,
                    },
                    {
                      label: "Non-Obvious Connection",
                      question: `What is the non-obvious connection this story has to another field? "${expandedArticle.title}" — ${expandedArticle.newtonSummary}`,
                    },
                    {
                      label: "What should I know?",
                      question: `What key context and background do I need to fully understand this story? "${expandedArticle.title}" — ${expandedArticle.newtonSummary}`,
                    },
                    {
                      label: "What happens next?",
                      question: `What are the implications of this story and where does it lead? "${expandedArticle.title}" — ${expandedArticle.newtonSummary}`,
                    },
                  ].map(({ label, question }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setExpandedArticle(null);
                        scrollToPanel("newton");
                        submitQuery(question);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isDark
                          ? "border-[#3a3a39] bg-transparent text-[#edebe8] hover:bg-[#262625]"
                          : "border-[#d4d4d4] bg-transparent text-[#1a1a1a] hover:bg-[#f0f0ef]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <a
                  href={expandedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex w-fit items-center gap-1.5 text-xs transition-colors ${
                    isDark ? "text-[#888886] hover:text-[#edebe8]" : "text-[#6b6b6b] hover:text-[#1a1a1a]"
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

      {/* Back to top */}
      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          className={`fixed bottom-6 right-6 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-90 focus:outline-none focus:ring-0 ${
            isDark
              ? "bg-[#1c1c1b]/80 text-[#edebe8] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
              : "bg-[#ffffff]/80 text-[#1a1a1a] shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
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
            className="h-4 w-4"
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
      )}

      {/* Dark mode toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`fixed right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-0 ${
          isDark
            ? "text-[#888886] hover:text-[#edebe8]"
            : "text-[#6b6b6b] hover:text-[#1a1a1a]"
        }`}
      >
        {isDark ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      <header className="flex shrink-0 flex-col items-center px-4 pt-10 pb-5 sm:px-6 sm:pb-6">
        <div className="w-full">
        {/* Logo */}
        <h1
          className={`mb-4 font-serif text-3xl font-normal tracking-tight sm:mb-5 sm:text-4xl ${
            isDark ? "text-[#edebe8]" : "text-[#1a1a1a]"
          }`}
        >
          Newton
        </h1>

        {/* Tab switcher */}
        <div
          role="tablist"
          aria-label="Switch between Feed and Newton"
          className="flex gap-6 border-b"
          style={isDark ? { borderColor: "#2a2a29" } : { borderColor: "#e5e4e2" }}
        >
          <button
            role="tab"
            aria-selected={activePanel === "feed"}
            onClick={() => scrollToPanel("feed")}
            className={`pb-2.5 text-xs font-medium transition-colors duration-200 ${
              activePanel === "feed"
                ? isDark
                  ? "text-[#edebe8] border-b-[1.5px] border-[#edebe8] -mb-[1.5px]"
                  : "text-[#1a1a1a] border-b-[1.5px] border-[#1a1a1a] -mb-[1.5px]"
                : isDark
                  ? "text-[#888886] hover:text-[#edebe8]"
                  : "text-[#6b6b6b] hover:text-[#1a1a1a]"
            }`}
          >
            Feed
          </button>
          <button
            role="tab"
            aria-selected={activePanel === "newton"}
            onClick={() => scrollToPanel("newton")}
            className={`pb-2.5 text-xs font-medium transition-colors duration-200 ${
              activePanel === "newton"
                ? isDark
                  ? "text-[#edebe8] border-b-[1.5px] border-[#edebe8] -mb-[1.5px]"
                  : "text-[#1a1a1a] border-b-[1.5px] border-[#1a1a1a] -mb-[1.5px]"
                : isDark
                  ? "text-[#888886] hover:text-[#edebe8]"
                  : "text-[#6b6b6b] hover:text-[#1a1a1a]"
            }`}
          >
            Newton
          </button>
        </div>
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
          <div className="flex w-full flex-col items-center gap-3 sm:gap-4">
            <div className="flex w-full items-center justify-end gap-0.5">
              <div className="relative" ref={sortDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSortDropdownOpen((o) => !o);
                  }}
                  aria-label="Sort feed"
                  aria-expanded={sortDropdownOpen}
                  aria-haspopup="listbox"
                  title={`Sort by ${feedSort}`}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    isDark
                      ? "text-[#888886] hover:bg-[#252524] hover:text-[#edebe8]"
                      : "text-[#6b6b6b] hover:bg-[#f0f0ef] hover:text-[#1a1a1a]"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3 shrink-0"
                  >
                    <path d="m3 16 4 4 4-4" />
                    <path d="M7 20V4" />
                    <path d="m21 8-4-4-4 4" />
                    <path d="M17 4v16" />
                  </svg>
                  <span className="capitalize">{feedSort}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`h-3 w-3 transition-transform ${sortDropdownOpen ? "rotate-180" : ""}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {sortDropdownOpen && (
                  <div
                    role="listbox"
                    className={`absolute left-0 top-full z-20 mt-1 min-w-[120px] rounded-md py-1 shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${
                      isDark
                        ? "border border-[#2a2a29] bg-[#1c1c1b]"
                        : "border border-[#e5e4e2] bg-[#ffffff] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                    }`}
                  >
                    {(["importance", "newest", "source"] as const).map((opt) => (
                      <button
                        key={opt}
                        role="option"
                        aria-selected={feedSort === opt}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFeedSort(opt);
                          setSortDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-medium capitalize transition-colors first:rounded-t-[5px] last:rounded-b-[5px] ${
                          feedSort === opt
                            ? isDark
                              ? "bg-[#252524] text-[#edebe8]"
                              : "bg-[#f5f5f4] text-[#1a1a1a]"
                            : isDark
                              ? "text-[#edebe8] hover:bg-[#252524]"
                              : "text-[#1a1a1a] hover:bg-[#f5f5f4]"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={cycleCardSize}
                title={`Card size: ${cardSize.charAt(0).toUpperCase() + cardSize.slice(1)}`}
                aria-label={`Card size: ${cardSize}`}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:opacity-80 focus:outline-none focus:ring-0 ${
                  isDark
                    ? "text-[#888886] hover:text-[#edebe8]"
                    : "text-[#6b6b6b] hover:text-[#1a1a1a]"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
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
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:opacity-80 focus:outline-none focus:ring-0 ${
                  isDark
                    ? "text-[#888886] hover:text-[#edebe8]"
                    : "text-[#6b6b6b] hover:text-[#1a1a1a]"
                }`}
              >
                {feedView === "card" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <line x1="8" x2="21" y1="6" y2="6" />
                    <line x1="8" x2="21" y1="12" y2="12" />
                    <line x1="8" x2="21" y1="18" y2="18" />
                    <line x1="3" x2="3.01" y1="6" y2="6" />
                    <line x1="3" x2="3.01" y1="12" y2="12" />
                    <line x1="3" x2="3.01" y1="18" y2="18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
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
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:opacity-80 focus:outline-none focus:ring-0 disabled:opacity-50 ${
                  isDark
                    ? "text-[#888886] hover:text-[#edebe8]"
                    : "text-[#6b6b6b] hover:text-[#1a1a1a]"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3.5 w-3.5 ${feedLoading ? "animate-spin" : ""}`}
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 21h5v-5" />
                </svg>
              </button>
            </div>
            {newStories.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFeedArticles((prev) => [...newStories, ...prev]);
                  setNewStories([]);
                }}
                className={`w-full rounded-full px-3 py-1.5 text-xs font-medium transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
                  isDark
                    ? "bg-[#1c1c1b] text-[#888886] hover:bg-[#262625] hover:text-[#edebe8]"
                    : "bg-[#ffffff] text-[#6b6b6b] hover:bg-[#f0f0ef] hover:text-[#1a1a1a]"
                }`}
              >
                ↑ {newStories.length} new {newStories.length === 1 ? "story" : "stories"}
              </button>
            )}
            {feedLoading && feedArticles.length === 0 && (
              <div className="flex w-full items-center justify-center py-16">
                <div className={`flex items-center gap-2 ${isDark ? "text-[#888886]" : "text-[#6b6b6b]"}`}>
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
              <p className={`w-full py-8 text-center text-sm ${isDark ? "text-[#888886]" : "text-[#6b6b6b]"}`}>No articles to show.</p>
            )}
            {!feedError && feedView === "list" && (
              <div
                className={`w-full rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
                  isDark ? "bg-[#1c1c1b]" : "bg-[#ffffff]"
                }`}
              >
                {sortedArticles.map((article, index) => {
                  const mutedCls = isDark ? "text-[#888886]" : "text-[#6b6b6b]";
                  const textCls = isDark ? "text-[#edebe8]" : "text-[#1a1a1a]";
                  return (
                    <button
                      key={article.url || index}
                      type="button"
                      onClick={() => handleGoDeeper(article.title)}
                      className={`flex w-full items-center gap-3 border-b px-4 py-2.5 text-left transition-colors first:rounded-t-lg last:border-b-0 last:rounded-b-lg ${
                        isDark ? "border-[#2a2a29] hover:bg-[#252524]" : "border-[#f0f0ef] hover:bg-[#fafaf9]"
                      }`}
                    >
                      <span className={`shrink-0 text-xs font-medium uppercase tracking-[0.1em] ${mutedCls}`} style={{ minWidth: "4rem" }}>
                        {article.tag}
                      </span>
                      <span className={`min-w-0 flex-1 truncate font-serif text-sm font-medium ${textCls}`}>
                        {article.title}
                      </span>
                      <div className="flex shrink-0 gap-0.5" aria-hidden>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span
                            key={i}
                            className={`h-1 w-1 shrink-0 rounded-full ${
                              i <= article.importance
                                ? isDark
                                  ? "bg-[#edebe8]"
                                  : "bg-[#1a1a1a]"
                                : isDark
                                  ? "border border-[#3a3a39] bg-transparent"
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
              feedView === "card" && (
              <div className="flex w-full flex-col gap-3">
                {sortedArticles.map((article, index) => {
                  const mutedCls = isDark ? "text-[#888886]" : "text-[#6b6b6b]";
                  const tagCls = isDark ? "text-[#888886]" : "text-[#888888]";
                  const textCls = isDark ? "text-[#edebe8]" : "text-[#1a1a1a]";

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
                      className={`relative w-full cursor-pointer rounded-lg transition-shadow shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.08)] ${
                        isDark ? "bg-[#1c1c1b] hover:shadow-[0_2px_6px_rgba(0,0,0,0.15)]" : "bg-[#ffffff]"
                      } ${isCompact ? "p-3" : isComfortable ? "p-6" : "p-4"}`}
                    >
                      {/* Top line: tag, importance dots, timestamp, source */}
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-medium uppercase tracking-[0.12em] ${tagCls}`}>
                          {article.tag}
                        </span>
                        <div className="flex gap-0.5" aria-label={`Importance: ${importance} of 5`}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span
                              key={i}
                              className={`shrink-0 rounded-full ${isCompact ? "h-1 w-1" : "h-1 w-1"} ${
                                i <= importance
                                  ? isDark
                                    ? "bg-[#edebe8]"
                                    : "bg-[#1a1a1a]"
                                  : isDark
                                    ? "border border-[#3a3a39] bg-transparent"
                                    : "border border-[#d4d4d4] bg-transparent"
                              }`}
                            />
                          ))}
                        </div>
                        <span className={`text-xs ${mutedCls}`}>
                          <time dateTime={article.publishedAt}>{formatRelativeTime(article.publishedAt)}</time>
                          <span className="mx-1.5">·</span>
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline"
                          >
                            {getSourceDisplay(article)}
                          </a>
                        </span>
                      </div>
                      <h2
                        className={`font-serif font-medium leading-tight ${textCls} ${
                          isCompact
                            ? "text-base"
                            : isComfortable
                              ? "text-xl mb-2"
                              : "text-lg mb-1.5"
                        }`}
                      >
                        {article.title}
                      </h2>
                      {!isCompact && (
                        <p
                          className={`text-sm leading-relaxed ${mutedCls} line-clamp-2 ${
                            isComfortable ? "mb-4" : "mb-3"
                          }`}
                        >
                          {article.newtonSummary}
                        </p>
                      )}
                      <div className={`flex items-center justify-between gap-2 ${isComfortable ? "mt-2" : ""}`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGoDeeper(article.title);
                          }}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            isDark
                              ? "border-[#3a3a39] bg-transparent text-[#edebe8] hover:bg-[#2a2a29]"
                              : "border-[#d4d4d4] bg-transparent text-[#1a1a1a] hover:bg-[#f5f5f4]"
                          }`}
                        >
                          Ask Newton
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Panel 2: Newton (search + response) */}
        <section
          role="tabpanel"
          aria-label="Newton"
          className="flex min-w-full shrink-0 snap-start snap-always flex-col items-center pb-8"
        >
          <div className="flex w-full flex-col items-center">
            <form onSubmit={handleSubmit} className="relative mb-10 w-full sm:mb-12">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask Newton anything..."
                disabled={isLoading}
                className={`w-full rounded-full py-3 pl-5 pr-14 text-sm transition-colors focus:outline-none focus:ring-0 disabled:opacity-60 sm:py-3.5 sm:pl-6 sm:pr-16 sm:text-base shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
                  isDark
                    ? "bg-[#1c1c1b] text-[#edebe8] placeholder:text-[#888886]"
                    : "bg-[#ffffff] text-[#1a1a1a] placeholder:text-[#6b6b6b]"
                }`}
                aria-label="Search"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#1a1a1a] text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:right-3 sm:h-8 sm:w-8"
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
                <div className={`flex items-center gap-2 ${isDark ? "text-[#888886]" : "text-[#6b6b6b]"}`}>
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
                  className={`rounded-lg px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
                    isDark ? "bg-[#1c1c1b]" : "bg-[#ffffff]"
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
    </div>
  );
}
