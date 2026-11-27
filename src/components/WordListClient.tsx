"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Circle, Layers, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  countVerbs,
  filterByVerbs,
  syncVerbsQueryParam,
  withVerbsParam,
} from "@/lib/word-filters";
import type { ProgressStatus, StudyWord } from "@/lib/supabase/types";

type ListTab = "all" | "unlearned" | "learned";

interface WordListClientProps {
  userId: string;
  initialWords: StudyWord[];
  studyHref?: string;
  initialVerbsOnly?: boolean;
}

export function WordListClient({
  userId,
  initialWords,
  studyHref,
  initialVerbsOnly = false,
}: WordListClientProps) {
  const [words, setWords] = useState<StudyWord[]>(initialWords);
  const [tab, setTab] = useState<ListTab>("all");
  const [verbsOnly, setVerbsOnly] = useState(initialVerbsOnly);
  const [query, setQuery] = useState("");
  const [syncError, setSyncError] = useState<string | null>(null);

  const verbCount = useMemo(() => countVerbs(words), [words]);
  const scopedWords = useMemo(
    () => filterByVerbs(words, verbsOnly),
    [words, verbsOnly]
  );

  const counts = useMemo(() => {
    let learned = 0;
    for (const w of scopedWords) {
      if (w.status === "learned") learned += 1;
    }
    return {
      all: scopedWords.length,
      unlearned: scopedWords.length - learned,
      learned,
    };
  }, [scopedWords]);

  const visibleWords = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return scopedWords.filter((w) => {
      if (tab !== "all" && w.status !== tab) return false;
      if (!q) return true;
      return (
        w.turkish.toLocaleLowerCase("tr-TR").includes(q) ||
        w.english.toLowerCase().includes(q) ||
        w.persian.includes(query.trim())
      );
    });
  }, [scopedWords, tab, query]);

  function handleVerbsToggle() {
    const next = !verbsOnly;
    setVerbsOnly(next);
    syncVerbsQueryParam(next);
  }

  async function toggleWordStatus(word: StudyWord) {
    const nextStatus: ProgressStatus =
      word.status === "learned" ? "unlearned" : "learned";
    const nextReviewCount = word.review_count + 1;

    setSyncError(null);
    setWords((prev) =>
      prev.map((item) =>
        item.id === word.id
          ? { ...item, status: nextStatus, review_count: nextReviewCount }
          : item
      )
    );

    try {
      const supabase = createClient();
      const { error } = await supabase.from("user_word_progress").upsert(
        {
          user_id: userId,
          word_id: word.id,
          status: nextStatus,
          review_count: nextReviewCount,
          last_reviewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,word_id" }
      );
      if (error) throw error;
    } catch {
      setWords((prev) =>
        prev.map((item) =>
          item.id === word.id
            ? {
                ...item,
                status: word.status,
                review_count: word.review_count,
              }
            : item
        )
      );
      setSyncError("Could not update word status. Check your connection.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pt-4 pb-safe">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Filter word list"
        className="grid grid-cols-3 gap-1.5 rounded-2xl border border-stone-200 bg-stone-100 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          onClick={() => setTab("all")}
          className={`rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
            tab === "all"
              ? "bg-white text-teal-800 shadow-xs"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          All ({counts.all})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "unlearned"}
          onClick={() => setTab("unlearned")}
          className={`rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
            tab === "unlearned"
              ? "bg-white text-teal-800 shadow-xs"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          To Learn ({counts.unlearned})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "learned"}
          onClick={() => setTab("learned")}
          className={`rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
            tab === "learned"
              ? "bg-white text-teal-800 shadow-xs"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          Learned ({counts.learned})
        </button>
      </div>

      {/* Search + Verbs toggle + Study one-by-one shortcut */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              verbsOnly
                ? "Filter verbs (Turkish, English, Persian)..."
                : "Filter Turkish, English, or Persian..."
            }
            aria-label="Filter vocabulary list"
            enterKeyHint="search"
            className="w-full rounded-2xl border border-stone-200 bg-white py-2.5 pr-4 pl-10 text-sm text-stone-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
          />
        </div>
        <button
          type="button"
          aria-pressed={verbsOnly}
          onClick={handleVerbsToggle}
          className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 text-xs font-semibold transition sm:text-sm ${
            verbsOnly
              ? "border-teal-700 bg-teal-50 text-teal-800 shadow-xs"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
          }`}
        >
          Verbs only ({verbCount})
        </button>
        {studyHref && (
          <Link
            href={withVerbsParam(studyHref, verbsOnly)}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-teal-700 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800 sm:text-sm"
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            Study
          </Link>
        )}
      </div>

      {syncError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
        >
          {syncError}
        </div>
      )}

      {/* Word rows */}
      {visibleWords.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
          {query.trim()
            ? `No ${verbsOnly ? "verbs" : "words"} match your search in this tab.`
            : tab === "unlearned"
              ? `No unlearned ${verbsOnly ? "verbs" : "words"} remaining here!`
              : tab === "learned"
                ? `No ${verbsOnly ? "verbs" : "words"} marked as learned yet.`
                : `No ${verbsOnly ? "verbs" : "words"} available.`}
        </div>
      ) : (
        <ul className="space-y-2.5 pb-6">
          {visibleWords.map((word) => {
            const isLearned = word.status === "learned";
            return (
              <li
                key={word.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3.5 shadow-xs"
              >
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 sm:grid-cols-3 sm:items-center sm:gap-3">
                  <div className="min-w-0">
                    <p lang="tr" className="text-base font-bold text-stone-900">
                      {word.turkish}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-stone-400">
                        #{word.frequency_rank}
                      </span>
                      <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500">
                        {word.type}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-stone-700">{word.english}</p>

                  <p
                    dir="rtl"
                    lang="fa"
                    className="font-persian text-base font-medium text-teal-900 sm:text-right"
                  >
                    {word.persian}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void toggleWordStatus(word)}
                  aria-label={
                    isLearned
                      ? `Mark ${word.turkish} as still learning`
                      : `Mark ${word.turkish} as learned`
                  }
                  title={isLearned ? "Mark as unlearned" : "Mark as learned"}
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${
                    isLearned
                      ? "border-teal-600 bg-teal-600 text-white hover:bg-teal-700"
                      : "border-stone-300 bg-stone-50 text-stone-400 hover:border-teal-600 hover:text-teal-700"
                  }`}
                >
                  {isLearned ? (
                    <Check className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Circle className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
