"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}

export function AppHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
}: AppHeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-stone-50/95 backdrop-blur-md pt-safe pb-2.5">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              aria-label={backLabel}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-stone-900">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs font-medium text-stone-500">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 active:scale-95"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
