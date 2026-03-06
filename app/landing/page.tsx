"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const THEME_STORAGE_KEY = "kurrnt-theme";

const AMBIENT_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=<>./,;:?!@#$%&*";
const AMBIENT_COUNT = 100;

const FEATURES = [
  {
    title: "The Feed",
    description: "Curated stories ranked by importance, so you see what matters first.",
  },
  {
    title: "Kepler's Insight",
    description: "AI-powered analysis that cuts through the noise and explains why it matters.",
  },
  {
    title: "Ask Kepler",
    description: "Go deeper on any story—ask questions and get clear, thoughtful answers.",
  },
] as const;

type AmbientChar = {
  char: string;
  x: number;
  y: number;
  opacitySeed: number;
  driftX: number;
  driftY: number;
  driftDuration: number;
  driftDelay: number;
};

function pickRandomChar() {
  return AMBIENT_CHARS[Math.floor(Math.random() * AMBIENT_CHARS.length)];
}

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [ambientChars, setAmbientChars] = useState<AmbientChar[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  function getIsDark(): boolean {
    if (typeof document === "undefined") return false;
    if (document.documentElement.classList.contains("dark")) return true;
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  useEffect(() => {
    setIsDark(getIsDark());
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setIsDark(getIsDark());
    mediaQuery.addEventListener("change", handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const chars: AmbientChar[] = [];
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const driftDistance = 60 + Math.random() * 120;
      const driftDuration = 20 + Math.random() * 40;
      chars.push({
        char: pickRandomChar(),
        x: Math.random() * w,
        y: Math.random() * h,
        opacitySeed: Math.random(),
        driftX: Math.cos(angle) * driftDistance,
        driftY: Math.sin(angle) * driftDistance,
        driftDuration,
        driftDelay: Math.random() * driftDuration * 0.3,
      });
    }
    setAmbientChars(chars);
  }, []);

  useEffect(() => {
    if (ambientChars.length === 0) return;
    const interval = setInterval(() => {
      setAmbientChars((prev) => {
        const next = [...prev];
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          const idx = Math.floor(Math.random() * next.length);
          next[idx] = { ...next[idx], char: pickRandomChar() };
        }
        return next;
      });
    }, 4000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [ambientChars.length]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <div
      className={`relative flex min-h-screen w-full flex-col transition-colors duration-200 ${
        isDark ? "bg-[#111110]" : "bg-[#f8f7f5]"
      }`}
    >
      {/* Ambient character background */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        {ambientChars.map(({ char, x, y, opacitySeed, driftX, driftY, driftDuration, driftDelay }, i) => {
          const opacity = isDark ? 0.03 + opacitySeed * 0.04 : 0.05 + opacitySeed * 0.04;
          const color = isDark ? "#ffffff" : "#000000";
          return (
            <span
              key={i}
              className="absolute font-mono text-[10px] select-none"
              style={{
                left: x,
                top: y,
                color,
                opacity,
                "--drift-x": `${driftX}px`,
                "--drift-y": `${driftY}px`,
                animation: `ambient-char-drift ${driftDuration}s linear ${driftDelay}s infinite alternate`,
              } as React.CSSProperties}
            >
              {char}
            </span>
          );
        })}
      </div>

      <div className="relative z-10">
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
          {user ? (
            <Link href="/feed" className="cursor-pointer no-underline transition-opacity hover:opacity-80">
              Kurrnt
            </Link>
          ) : (
            <span>Kurrnt</span>
          )}
        </h1>
        <p
          className={`mb-2 text-sm font-medium tracking-[0.2em] uppercase sm:text-base ${
            isDark ? "text-[#888886]" : "text-[#6b6b6b]"
          }`}
        >
          Intelligent Media for the New Age
        </p>
        <p
          className={`mb-10 text-center text-sm leading-relaxed sm:text-base ${
            isDark ? "text-[#888886]" : "text-[#6b6b6b]"
          }`}
        >
          Pure signal, no noise.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/onboarding"
            className={`inline-flex items-center justify-center rounded px-10 py-4 text-sm font-medium tracking-wide transition-all duration-200 ${
              isDark
                ? "bg-white text-[#111110] hover:opacity-90"
                : "bg-[#1a1a1a] text-white hover:opacity-90"
            }`}
          >
            Get Started
          </Link>
          <Link
            href="/signin"
            className={`inline-flex items-center justify-center rounded px-10 py-4 text-sm font-medium tracking-wide transition-all duration-200 ${
              isDark
                ? "border border-[#3a3a39] text-[#edebe8] hover:bg-[#252524]"
                : "border border-[#1a1a1a] text-[#1a1a1a] hover:bg-[#f0f0ef]"
            }`}
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Three-column features */}
      <section
        className={`border-t px-4 py-16 sm:px-6 ${
          isDark ? "border-[#3a3a39]" : "border-[#e5e4e2]"
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
    </div>
  );
}
