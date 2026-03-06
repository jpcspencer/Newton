"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const THEME_STORAGE_KEY = "kurrnt-theme";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    setIsDark(stored === "dark");
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/feed");
    });
  }, [router]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
  }

  async function handleGoogleSignIn() {
    setAuthLoading(true);
    setAuthError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });

    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
      return;
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || authLoading) return;

    setAuthLoading(true);
    setAuthError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });

    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
      return;
    }
    setMagicLinkSent(true);
    setAuthLoading(false);
  }

  return (
    <div
      className={`relative flex min-h-screen w-full flex-col transition-colors duration-200 ${
        isDark ? "bg-[#0a0f1e]" : "bg-[#f4f6fb]"
      }`}
    >
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`fixed right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-0 ${
          isDark
            ? "text-[#8896a8] hover:text-[#e8edf5]"
            : "text-[#4a5568] hover:text-[#0a0f1e]"
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

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-16">
        <section className="flex w-full max-w-md flex-col items-center text-center">
          <h2
            className={`mb-4 font-serif text-2xl font-normal tracking-tight sm:text-3xl ${
              isDark ? "text-[#e8edf5]" : "text-[#0a0f1e]"
            }`}
          >
            Create your account
          </h2>
          <p
            className={`mb-8 text-sm leading-relaxed ${
              isDark ? "text-[#8896a8]" : "text-[#4a5568]"
            }`}
          >
            Sign in to save your interests and pick up where you left off.
          </p>

          <div className="mb-6 flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className={`flex w-full items-center justify-center gap-2 rounded px-6 py-3.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                isDark
                  ? "bg-[#2563eb] text-white hover:opacity-90"
                  : "bg-[#2563eb] text-white hover:opacity-90"
              }`}
            >
              {authLoading ? (
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>

            <div className={`flex items-center gap-3 ${isDark ? "text-[#8896a8]" : "text-[#4a5568]"}`}>
              <span className="h-px flex-1 bg-current opacity-30" />
              <span className="text-xs">or</span>
              <span className="h-px flex-1 bg-current opacity-30" />
            </div>

            {magicLinkSent ? (
              <p className={`text-sm ${isDark ? "text-[#e8edf5]" : "text-[#0a0f1e]"}`}>
                Check your email for the magic link.
              </p>
            ) : (
              <form onSubmit={handleMagicLink} className="flex w-full flex-col gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={authLoading}
                  className={`w-full rounded px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-0 ${
                    isDark
                      ? "bg-[#111827] text-[#e8edf5] placeholder:text-[#8896a8]"
                      : "bg-white text-[#0a0f1e] placeholder:text-[#4a5568]"
                  }`}
                />
                <button
                  type="submit"
                  disabled={authLoading}
                  className={`rounded px-6 py-3 text-sm font-medium transition-colors disabled:opacity-60 ${
                    isDark
                      ? "border border-[#1e2d4a] text-[#e8edf5] hover:bg-[#111827]"
                      : "border border-[#dde3ed] text-[#0a0f1e] hover:bg-[#dde3ed]"
                  }`}
                >
                  Send magic link
                </button>
              </form>
            )}
          </div>

          {authError && (
            <p className={`mb-4 text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>
              {authError}
            </p>
          )}

          <Link
            href="/"
            className={`text-sm transition-colors ${
              isDark ? "text-[#8896a8] hover:text-[#e8edf5]" : "text-[#4a5568] hover:text-[#0a0f1e]"
            }`}
          >
            Back to home
          </Link>
        </section>
      </main>
    </div>
  );
}
