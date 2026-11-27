import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SAFE_HOST_PATTERN = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

function sanitizeNextPath(rawNext: string | null): string {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//")) {
    return "/courses";
  }
  try {
    const parsed = new URL(rawNext, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return "/courses";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/courses";
  }
}

function resolveOrigin(request: NextRequest): string {
  const { origin } = new URL(request.url);
  if (process.env.NODE_ENV === "development") {
    return origin;
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (forwardedHost && SAFE_HOST_PATTERN.test(forwardedHost)) {
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    const proto = forwardedProto === "http" ? "http" : "https";
    return `${proto}://${forwardedHost}`;
  }

  return origin;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error");
  const next = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const baseOrigin = resolveOrigin(request);

  if (oauthError) {
    const errorCode =
      oauthError === "access_denied" ? "cancelled" : "oauth_failed";
    return NextResponse.redirect(`${baseOrigin}/login?auth_error=${errorCode}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseOrigin}/login?auth_error=oauth_failed`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(`${baseOrigin}/login?auth_error=oauth_failed`);
    }
  } catch {
    return NextResponse.redirect(`${baseOrigin}/login?auth_error=oauth_failed`);
  }

  return NextResponse.redirect(`${baseOrigin}${next}`);
}
