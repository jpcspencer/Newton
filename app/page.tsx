"use client";

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
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

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white px-4 py-12 sm:px-6">
      <main className="flex w-full max-w-2xl flex-col items-center">
        {/* Logo */}
        <h1 className="mb-12 font-serif text-5xl font-normal tracking-tight text-[#171717] sm:mb-16 sm:text-6xl md:text-7xl">
          Newton
        </h1>

        {/* Search bar */}
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

        {/* Response / Loading / Error */}
        <div className="mb-10 w-full sm:mb-12">
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
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#171717]">
                {response}
              </p>
            </div>
          )}
        </div>

        {/* Navigation strip */}
        <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-[#525252] sm:gap-x-10">
          <a
            href="#"
            className="transition-colors hover:text-[#171717]"
          >
            Recent Papers
          </a>
          <a
            href="#"
            className="transition-colors hover:text-[#171717]"
          >
            Science News
          </a>
          <a
            href="#"
            className="transition-colors hover:text-[#171717]"
          >
            Discoveries
          </a>
        </nav>
      </main>
    </div>
  );
}
