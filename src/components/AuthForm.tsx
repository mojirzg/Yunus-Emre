"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  mode: "signin" | "signup";
  initialErrorCode?: string;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  cancelled: "Google sign-in was cancelled. Please try again.",
  oauth_failed: "Could not complete Google sign-in. Please try again.",
};

function GoogleMark() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function AuthForm({ mode, initialErrorCode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    initialErrorCode ? (AUTH_ERROR_MESSAGES[initialErrorCode] ?? null) : null
  );
  const [info, setInfo] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<
    "idle" | "password" | "google"
  >("idle");

  const isSignUp = mode === "signup";
  const isBusy = activeAction !== "idle";
  const isGoogleLoading = activeAction === "google";
  const isPasswordLoading = activeAction === "password";

  async function handleGoogleSignIn() {
    setError(null);
    setInfo(null);
    setActiveAction("google");

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setActiveAction("idle");
      }
    } catch {
      setError("Unable to reach Google authentication. Please try again.");
      setActiveAction("idle");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setActiveAction("password");

    try {
      const supabase = createClient();

      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data.session) {
          router.replace("/courses");
          router.refresh();
          return;
        }

        setInfo(
          "Account created. Check your email to confirm your address, then sign in."
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }

        router.replace("/courses");
        router.refresh();
      }
    } catch {
      setError("Unable to reach authentication service. Please try again.");
    } finally {
      setActiveAction("idle");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-safe pt-safe pb-safe py-8">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-white">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">
              {isSignUp ? "Create your account" : "Sign in to Türkçe Vocab"}
            </h1>
            <p className="text-sm text-stone-600">
              Yedi İklim Türkçe — English &amp; Persian
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {info && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-sm text-teal-800"
          >
            {info}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isBusy}
          aria-busy={isGoogleLoading}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-semibold text-stone-800 shadow-xs transition hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 active:scale-[0.99] disabled:opacity-60"
        >
          <GoogleMark />
          <span>
            {isGoogleLoading
              ? "Redirecting to Google..."
              : "Continue with Google"}
          </span>
        </button>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-stone-200" />
          <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">
            or continue with email
          </span>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-stone-800"
            >
              Email address
            </label>
            <span id="email-hint" className="mt-0.5 block text-xs text-stone-500">
              Use the email you want synced across devices
            </span>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="email-hint"
              placeholder="you@example.com"
              className="auth-input mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-stone-800"
            >
              Password
            </label>
            {isSignUp && (
              <span
                id="password-hint"
                className="mt-0.5 block text-xs text-stone-500"
              >
                At least 6 characters
              </span>
            )}
            <div className="relative mt-1.5">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                enterKeyHint="done"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={isSignUp ? "password-hint" : undefined}
                placeholder="••••••••"
                className="auth-input w-full rounded-xl border border-stone-300 bg-white py-2.5 pr-12 pl-3.5 text-base text-stone-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isBusy}
            aria-busy={isPasswordLoading}
            className="min-h-12 w-full rounded-xl bg-teal-700 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 active:scale-[0.99] disabled:opacity-60"
          >
            {isPasswordLoading
              ? isSignUp
                ? "Creating account..."
                : "Signing in..."
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-600">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-teal-700 underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link
                href="/signup"
                className="font-semibold text-teal-700 underline-offset-4 hover:underline"
              >
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
