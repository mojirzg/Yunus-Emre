"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { HeaderUser } from "@/lib/supabase/user-profile";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  user?: HeaderUser;
}

export function AppHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  user,
}: AppHeaderProps) {
  const router = useRouter();
  const [avatarFailed, setAvatarFailed] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const showAvatarImage = Boolean(user?.avatarUrl) && !avatarFailed;
  const userTooltip = user
    ? user.email
      ? `${user.displayName} (${user.email})`
      : user.displayName
    : undefined;

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

        <div className="flex shrink-0 items-center gap-2">
          {user && (
            <div
              title={userTooltip}
              className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-2 py-1.5"
            >
              {showAvatarImage && user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800"
                >
                  {user.initials}
                </span>
              )}
              <span className="sr-only max-w-28 truncate text-xs font-semibold text-stone-700 sm:not-sr-only">
                {user.displayName}
              </span>
            </div>
          )}

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
      </div>
    </header>
  );
}
