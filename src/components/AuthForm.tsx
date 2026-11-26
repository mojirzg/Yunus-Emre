"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  mode: "signin" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === "signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

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
      setLoading(false);
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

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {info && (
            <div
              role="status"
              className="rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-sm text-teal-800"
            >
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-teal-700 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.99] disabled:opacity-60"
          >
            {loading
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
