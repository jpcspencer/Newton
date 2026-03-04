"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const THEME_STORAGE_KEY = "newton-theme";

const FEATURES = [
  {
    title: "The Feed",
    description: "Curated stories ranked by importance, so you see what matters first.",
  },
  {
    title: "Newton's Insight",
    description: "AI-powered analysis that cuts through the noise and explains why it matters.",
  },
  {
    title: "Ask Newton",
    description: "Go deeper on any story—ask questions and get clear, thoughtful answers.",
  },
] as const;

export default function LandingPage() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    setIsDark(stored === "dark");
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
  }

  return (
    <div
      className={`flex min-h-screen w-full flex-col transition-colors duration-200 ${
        isDark ? "bg-[#111110]" : "bg-[#f8f7f5]"
      }`}
    >
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

      {/* Hero section */}
      <section className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
        <h1
          className={`mb-4 font-serif text-4xl font-normal tracking-tight sm:text-5xl md:text-6xl ${
            isDark ? "text-[#edebe8]" : "text-[#1a1a1a]"
          }`}
        >
          Newton
        </h1>
        <p
          className={`mb-2 text-sm font-medium tracking-[0.2em] uppercase sm:text-base ${
            isDark ? "text-[#888886]" : "text-[#6b6b6b]"
          }`}
        >
          Intelligent Media for the AI Age
        </p>
        <p
          className={`mb-10 text-center text-sm leading-relaxed sm:text-base ${
            isDark ? "text-[#888886]" : "text-[#6b6b6b]"
          }`}
        >
          Signal, not noise. The feed that keeps you sharp.
        </p>
        <Link
          href="/feed"
          className={`inline-flex items-center justify-center rounded px-10 py-4 text-sm font-medium tracking-wide transition-all duration-200 ${
            isDark
              ? "bg-white text-[#111110] hover:opacity-90"
              : "bg-[#1a1a1a] text-white hover:opacity-90"
          }`}
        >
          Enter Newton
        </Link>
      </section>

      {/* Three-column features */}
      <section
        className={`border-t px-4 py-16 sm:px-6 ${
          isDark ? "border-[#2a2a29]" : "border-[#e5e4e2]"
        }`}
      >
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-12 sm:grid-cols-3">
          {FEATURES.map(({ title, description }) => (
            <div key={title} className="flex flex-col items-center text-center">
              <h3
                className={`mb-2 font-serif text-lg font-medium ${
                  isDark ? "text-[#edebe8]" : "text-[#1a1a1a]"
                }`}
              >
                {title}
              </h3>
              <p
                className={`text-sm leading-relaxed ${
                  isDark ? "text-[#888886]" : "text-[#6b6b6b]"
                }`}
              >
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
