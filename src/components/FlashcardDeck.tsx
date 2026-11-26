"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  List,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Volume2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ProgressStatus, StudyWord } from "@/lib/supabase/types";

type FilterMode = "unlearned" | "all" | "learned";
type StudyMode = "manual" | "timer" | "auto";

interface FlashcardDeckProps {
  userId: string;
  initialWords: StudyWord[];
  wordsListHref: string;
  backToCourseHref: string;
}

const SWIPE_THRESHOLD = 72;
const REVEAL_DELAY_MS = 5000;
const AUTO_NEXT_DELAY_MS = 3000;
const MODE_STORAGE_KEY = "turkce-vocab:study-mode";

const MODES: { key: StudyMode; label: string; hint: string }[] = [
  { key: "manual", label: "Manual", hint: "Tap Show Meaning to reveal" },
  { key: "timer", label: "Timer 5s", hint: "Meaning appears after 5 seconds" },
  {
    key: "auto",
    label: "Auto-play",
    hint: "Reveals after 5s, then moves to the next word",
  },
];

export function FlashcardDeck({
  userId,
  initialWords,
  wordsListHref,
  backToCourseHref,
}: FlashcardDeckProps) {
  const [words, setWords] = useState<StudyWord[]>(initialWords);
  const [filter, setFilter] = useState<FilterMode>("unlearned");
  const [mode, setMode] = useState<StudyMode>("manual");
  const [paused, setPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (saved === "manual" || saved === "timer" || saved === "auto") {
      setMode(saved);
    }
  }, []);

  const counts = useMemo(() => {
    let learned = 0;
    for (const w of words) if (w.status === "learned") learned += 1;
    return { all: words.length, learned, unlearned: words.length - learned };
  }, [words]);

  const deck = useMemo(() => {
    if (filter === "unlearned") return words.filter((w) => w.status === "unlearned");
    if (filter === "learned") return words.filter((w) => w.status === "learned");
    return words;
  }, [words, filter]);

  const safeIndex = deck.length === 0 ? 0 : Math.min(currentIndex, deck.length - 1);
  const currentWord = deck[safeIndex] ?? null;
  const overallPercent =
    counts.all === 0 ? 0 : Math.round((counts.learned / counts.all) * 100);

  function resetCard() {
    setRevealed(false);
    setDragX(0);
  }

  function handleFilterChange(next: FilterMode) {
    setFilter(next);
    setCurrentIndex(0);
    resetCard();
  }

  function handleModeChange(next: StudyMode) {
    setMode(next);
    setPaused(false);
    setRevealed(false);
    window.localStorage.setItem(MODE_STORAGE_KEY, next);
  }

  const speakTurkish = useCallback(
    (text: string) => {
      if (!ttsSupported) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "tr-TR";
        utterance.rate = 0.92;
        const trVoice = window.speechSynthesis
          .getVoices()
          .find((v) => v.lang.toLowerCase().startsWith("tr"));
        if (trVoice) utterance.voice = trVoice;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore TTS errors on restricted browsers
      }
    },
    [ttsSupported]
  );

  const persistProgress = useCallback(
    async (word: StudyWord, nextStatus: ProgressStatus, nextReviewCount: number) => {
      setSyncError(null);
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
      if (error) {
        setWords((prev) =>
          prev.map((item) =>
            item.id === word.id
              ? { ...item, status: word.status, review_count: word.review_count }
              : item
          )
        );
        setSyncError("Could not save progress. Check your connection.");
      }
    },
    [userId]
  );

  /** Move to the next card without changing its status (used by Auto-play and Skip). */
  const goNext = useCallback(() => {
    resetCard();
    setCurrentIndex((prev) => (deck.length <= 1 ? 0 : (prev + 1) % deck.length));
  }, [deck.length]);

  const goPrev = useCallback(() => {
    resetCard();
    setCurrentIndex((prev) =>
      deck.length <= 1 ? 0 : (prev - 1 + deck.length) % deck.length
    );
  }, [deck.length]);

  const handleAction = useCallback(
    (action: "still_learning" | "know_this") => {
      if (!currentWord) return;
      const target = currentWord;
      const nextStatus: ProgressStatus = action === "know_this" ? "learned" : "unlearned";
      const nextReviewCount = target.review_count + 1;
      const staysInFilter =
        filter === "all" ||
        (filter === "unlearned" && nextStatus === "unlearned") ||
        (filter === "learned" && nextStatus === "learned");

      setWords((prev) =>
        prev.map((w) =>
          w.id === target.id ? { ...w, status: nextStatus, review_count: nextReviewCount } : w
        )
      );
      resetCard();
      if (staysInFilter) {
        setCurrentIndex((prev) => (deck.length <= 1 ? 0 : (prev + 1) % deck.length));
      } else {
        // The card leaves this filtered deck, so the same index now points at the next card.
        setCurrentIndex((prev) => (deck.length <= 1 ? 0 : Math.min(prev, deck.length - 2)));
      }
      void persistProgress(target, nextStatus, nextReviewCount);
    },
    [currentWord, deck.length, filter, persistProgress]
  );

  // Timer + Auto-play scheduling
  const currentId = currentWord?.id;
  useEffect(() => {
    if (!currentId || mode === "manual" || paused) return;
    if (!revealed) {
      const t = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
      return () => window.clearTimeout(t);
    }
    if (mode === "auto") {
      const t = window.setTimeout(goNext, AUTO_NEXT_DELAY_MS);
      return () => window.clearTimeout(t);
    }
  }, [currentId, mode, paused, revealed, goNext]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        setRevealed(true);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleAction("know_this");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleAction("still_learning");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAction]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) setDragX(dx);
  }

  function onPointerEnd() {
    if (!pointerStartRef.current) return;
    pointerStartRef.current = null;
    setIsDragging(false);
    if (dragX >= SWIPE_THRESHOLD) return handleAction("know_this");
    if (dragX <= -SWIPE_THRESHOLD) return handleAction("still_learning");
    setDragX(0);
  }

  const swipeDirection = dragX > 28 ? "right" : dragX < -28 ? "left" : null;
  const timerPhase: "reveal" | "next" | null =
    mode === "manual" || paused || !currentWord
      ? null
      : !revealed
        ? "reveal"
        : mode === "auto"
          ? "next"
          : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-3 pb-40">
      <div className="space-y-3">
        {/* Progress */}
        <div className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-stone-600">
            <span>
              {deck.length > 0 ? `Word ${safeIndex + 1} of ${deck.length}` : "No words in this filter"}
            </span>
            <span className="font-semibold text-teal-700">
              {counts.learned} / {counts.all} learned ({overallPercent}%)
            </span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-100"
            role="progressbar"
            aria-valuenow={overallPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Learned words"
          >
            <div
              className="h-full rounded-full bg-teal-600 transition-all duration-300"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>

        {/* Filter */}
        <div
          role="tablist"
          aria-label="Which words to study"
          className="grid grid-cols-3 gap-1.5 rounded-2xl border border-stone-200 bg-stone-100 p-1"
        >
          {(
            [
              { key: "unlearned", label: "Still to Learn", count: counts.unlearned },
              { key: "all", label: "All", count: counts.all },
              { key: "learned", label: "Learned", count: counts.learned },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filter === tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={`rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                filter === tab.key ? "bg-white text-teal-800 shadow-xs" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Study mode + list view */}
        <div className="flex items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Study mode"
            className="grid flex-1 grid-cols-3 gap-1 rounded-2xl border border-stone-200 bg-white p-1"
          >
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={mode === m.key}
                title={m.hint}
                onClick={() => handleModeChange(m.key)}
                className={`rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                  mode === m.key ? "bg-teal-700 text-white" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Link
            href={wordsListHref}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 hover:bg-stone-100 sm:text-sm"
          >
            <List className="h-4 w-4" aria-hidden="true" />
            All words
          </Link>
        </div>
        <p className="px-1 text-xs text-stone-500">{MODES.find((m) => m.key === mode)?.hint}</p>

        {syncError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {syncError}
          </div>
        )}
      </div>

      {/* Card */}
      <div className="my-5 flex flex-1 flex-col justify-center">
        {currentWord ? (
          <div
            className="relative w-full touch-pan-y select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            style={{
              transform: `translateX(${dragX}px) rotate(${dragX * 0.03}deg)`,
              transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <article
              aria-live="polite"
              className={`relative flex min-h-[20rem] flex-col rounded-3xl border bg-white p-6 shadow-md transition-colors ${
                swipeDirection === "right"
                  ? "border-teal-500 bg-teal-50/50"
                  : swipeDirection === "left"
                    ? "border-amber-400 bg-amber-50/50"
                    : "border-stone-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                    #{currentWord.frequency_rank}
                  </span>
                  {currentWord.status === "learned" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Learned
                    </span>
                  )}
                </div>
                {ttsSupported && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => speakTurkish(currentWord.turkish)}
                    aria-label={`Pronounce ${currentWord.turkish}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-teal-700 hover:bg-teal-50 active:scale-95"
                  >
                    <Volume2 className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
              </div>

              <p
                lang="tr"
                className="mt-6 mb-4 text-center font-bold tracking-tight text-stone-900"
                style={{ fontSize: "clamp(1.75rem, 1.2rem + 2.5vw, 2.5rem)", lineHeight: 1.2 }}
              >
                {currentWord.turkish}
              </p>

              <div className="mt-auto">
                {revealed ? (
                  <div className="space-y-4 border-t border-stone-100 pt-4 text-center">
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">English</span>
                      <p className="mt-1 text-xl font-semibold text-stone-900">{currentWord.english}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">Persian</span>
                      <p dir="rtl" lang="fa" className="font-persian mt-1 text-2xl leading-relaxed font-semibold text-teal-900">
                        {currentWord.persian}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-stone-100 pt-4 text-center text-sm text-stone-400">
                    {mode === "manual" ? "Meaning hidden" : paused ? "Paused" : "Meaning appears in 5 seconds…"}
                  </div>
                )}

                {timerPhase && (
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
                    <div
                      key={`${currentWord.id}-${timerPhase}`}
                      className="countdown-bar h-full rounded-full bg-teal-500"
                      style={{
                        animationDuration: `${timerPhase === "reveal" ? REVEAL_DELAY_MS : AUTO_NEXT_DELAY_MS}ms`,
                      }}
                    />
                  </div>
                )}
              </div>

              {swipeDirection && (
                <div
                  className={`pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-xl px-3 py-1.5 text-xs font-bold tracking-wide text-white uppercase ${
                    swipeDirection === "right" ? "bg-teal-600" : "bg-amber-500"
                  }`}
                >
                  {swipeDirection === "right" ? "I Know This" : "Still Learning"}
                </div>
              )}
            </article>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={goPrev}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous
              </button>
              {mode !== "manual" && (
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                >
                  {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
                  {paused ? "Resume" : "Pause"}
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100"
              >
                Skip <SkipForward className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-stone-900">
              {filter === "unlearned"
                ? "All words in this deck are learned!"
                : filter === "learned"
                  ? "No learned words yet"
                  : "No words available"}
            </h2>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {filter !== "all" && counts.all > 0 && (
                <button
                  type="button"
                  onClick={() => handleFilterChange("all")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Review all ({counts.all})
                </button>
              )}
              <Link
                href={backToCourseHref}
                className="inline-flex items-center rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              >
                Back to course
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      {currentWord && (
        <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-stone-200/80 bg-stone-50/95 pt-3 pb-safe backdrop-blur-md">
          <div className="mx-auto w-full max-w-2xl px-4">
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3.5 text-base font-bold text-white shadow-sm hover:bg-teal-800 active:scale-[0.99]"
              >
                <Eye className="h-5 w-5" aria-hidden="true" />
                Show Meaning
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleAction("still_learning")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-sm font-bold text-amber-900 hover:bg-amber-100 active:scale-[0.98] sm:text-base"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Still Learning
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("know_this")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3.5 text-sm font-bold text-white hover:bg-teal-800 active:scale-[0.98] sm:text-base"
                >
                  I Know This
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
