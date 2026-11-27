import type { User } from "@supabase/supabase-js";

export interface HeaderUser {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  initials: string;
}

function toSafeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function buildInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getHeaderUser(user: User): HeaderUser {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const rawName =
    typeof metadata.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : typeof metadata.name === "string" && metadata.name.trim()
        ? metadata.name.trim()
        : null;

  const email = user.email ?? null;
  const emailPrefix = email ? email.split("@")[0] : null;
  const displayName = rawName ?? emailPrefix ?? "Learner";
  const avatarUrl =
    toSafeHttpsUrl(metadata.avatar_url) ?? toSafeHttpsUrl(metadata.picture);

  return {
    displayName,
    email,
    avatarUrl,
    initials: buildInitials(displayName),
  };
}
