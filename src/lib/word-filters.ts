import type { StudyWord } from "@/lib/supabase/types";

/** Filter words to verbs only when `verbsOnly` is enabled. */
export function filterByVerbs(
  words: StudyWord[],
  verbsOnly: boolean
): StudyWord[] {
  return verbsOnly ? words.filter((w) => w.type === "verb") : words;
}

/** Count how many words in the list have `type === "verb"`. */
export function countVerbs(words: StudyWord[]): number {
  let count = 0;
  for (const w of words) {
    if (w.type === "verb") count += 1;
  }
  return count;
}

/** Append `?verbs=1` (or preserve existing query params) when `verbsOnly` is true. */
export function withVerbsParam(href: string, verbsOnly: boolean): string {
  if (!verbsOnly) return href;
  const [path, search = ""] = href.split("?");
  const params = new URLSearchParams(search);
  params.set("verbs", "1");
  return `${path}?${params.toString()}`;
}

/** Update the current browser URL's `?verbs=1` query param without a navigation. */
export function syncVerbsQueryParam(verbsOnly: boolean): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (verbsOnly) {
    url.searchParams.set("verbs", "1");
  } else {
    url.searchParams.delete("verbs");
  }
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}
