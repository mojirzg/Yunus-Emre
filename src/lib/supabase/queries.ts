import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Course,
  CourseWithProgress,
  Lesson,
  LessonWithProgress,
  ProgressStatus,
  StudyWord,
  Word,
} from "./types";

const PAGE_SIZE = 1000;

/**
 * Fetches all rows for a query using .range() pagination so Supabase's
 * 1,000-row default response cap never truncates vocabulary or progress data.
 */
async function fetchAll<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) {
      throw new Error(error.message);
    }
    if (!data || data.length === 0) {
      break;
    }
    rows.push(...data);
    if (data.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return rows;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function calcPercentage(learned: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((learned / total) * 100);
}

async function getLearnedWordIdSet(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const progressRows = await fetchAll<{ word_id: string }>((from, to) =>
    supabase
      .from("user_word_progress")
      .select("word_id")
      .eq("user_id", userId)
      .eq("status", "learned")
      .range(from, to)
  );
  return new Set(progressRows.map((row) => row.word_id));
}

export async function getCoursesWithProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<CourseWithProgress[]> {
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id, code, title, description, sort_order, is_published")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (coursesError) throw new Error(coursesError.message);
  if (!courses || courses.length === 0) return [];

  const courseIds = courses.map((c) => c.id);
  const lessons = await fetchAll<Pick<Lesson, "id" | "course_id">>((from, to) =>
    supabase
      .from("lessons")
      .select("id, course_id")
      .in("course_id", courseIds)
      .range(from, to)
  );

  const lessonIds = lessons.map((l) => l.id);
  const lessonToCourse = new Map(lessons.map((l) => [l.id, l.course_id]));

  const [lessonWords, learnedSet] = await Promise.all([
    lessonIds.length > 0
      ? fetchAll<{ lesson_id: string; word_id: string }>((from, to) =>
          supabase
            .from("lesson_words")
            .select("lesson_id, word_id")
            .in("lesson_id", lessonIds)
            .range(from, to)
        )
      : Promise.resolve([]),
    getLearnedWordIdSet(supabase, userId),
  ]);

  const courseWordSets = new Map<string, Set<string>>();
  for (const c of courses) {
    courseWordSets.set(c.id, new Set<string>());
  }

  for (const lw of lessonWords) {
    const courseId = lessonToCourse.get(lw.lesson_id);
    if (!courseId) continue;
    courseWordSets.get(courseId)?.add(lw.word_id);
  }

  return (courses as Course[]).map((course) => {
    const wordSet = courseWordSets.get(course.id) ?? new Set<string>();
    let learnedWords = 0;
    for (const wordId of wordSet) {
      if (learnedSet.has(wordId)) {
        learnedWords += 1;
      }
    }
    const totalWords = wordSet.size;
    return {
      ...course,
      totalWords,
      learnedWords,
      percentage: calcPercentage(learnedWords, totalWords),
    };
  });
}

export async function getCourseDetailWithProgress(
  supabase: SupabaseClient,
  userId: string,
  courseCode: string
): Promise<{
  course: CourseWithProgress;
  lessons: LessonWithProgress[];
} | null> {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, code, title, description, sort_order, is_published")
    .eq("code", courseCode.toUpperCase())
    .eq("is_published", true)
    .maybeSingle();

  if (courseError) throw new Error(courseError.message);
  if (!course) return null;

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, course_id, unit_number, title, sort_order")
    .eq("course_id", course.id)
    .order("sort_order", { ascending: true })
    .order("unit_number", { ascending: true });

  if (lessonsError) throw new Error(lessonsError.message);

  const lessonRows = (lessons ?? []) as Lesson[];
  const lessonIds = lessonRows.map((l) => l.id);

  const [lessonWords, learnedSet] = await Promise.all([
    lessonIds.length > 0
      ? fetchAll<{ lesson_id: string; word_id: string }>((from, to) =>
          supabase
            .from("lesson_words")
            .select("lesson_id, word_id")
            .in("lesson_id", lessonIds)
            .range(from, to)
        )
      : Promise.resolve([]),
    getLearnedWordIdSet(supabase, userId),
  ]);

  const lessonWordMap = new Map<string, Set<string>>();
  for (const lesson of lessonRows) {
    lessonWordMap.set(lesson.id, new Set<string>());
  }

  const courseWordSet = new Set<string>();
  for (const lw of lessonWords) {
    lessonWordMap.get(lw.lesson_id)?.add(lw.word_id);
    courseWordSet.add(lw.word_id);
  }

  let courseLearned = 0;
  for (const wordId of courseWordSet) {
    if (learnedSet.has(wordId)) courseLearned += 1;
  }

  const lessonsWithProgress: LessonWithProgress[] = lessonRows.map((lesson) => {
    const wordSet = lessonWordMap.get(lesson.id) ?? new Set<string>();
    let learnedWords = 0;
    for (const wordId of wordSet) {
      if (learnedSet.has(wordId)) learnedWords += 1;
    }
    const totalWords = wordSet.size;
    return {
      ...lesson,
      totalWords,
      learnedWords,
      percentage: calcPercentage(learnedWords, totalWords),
    };
  });

  return {
    course: {
      ...(course as Course),
      totalWords: courseWordSet.size,
      learnedWords: courseLearned,
      percentage: calcPercentage(courseLearned, courseWordSet.size),
    },
    lessons: lessonsWithProgress,
  };
}

async function loadStudyWordsForLessonIds(
  supabase: SupabaseClient,
  userId: string,
  lessonIds: string[]
): Promise<StudyWord[]> {
  if (lessonIds.length === 0) return [];

  const lessonChunks = chunkArray(lessonIds, 50);

  const [lessonWordsNested, progressRows] = await Promise.all([
    Promise.all(
      lessonChunks.map((chunk) =>
        fetchAll<{ word_id: string; words: Word | Word[] | null }>(
          (from, to) =>
            supabase
              .from("lesson_words")
              .select("word_id, words(id, turkish, english, persian, frequency_rank, type)")
              .in("lesson_id", chunk)
              .range(from, to)
        )
      )
    ),
    fetchAll<{
      word_id: string;
      status: ProgressStatus;
      review_count: number;
    }>((from, to) =>
      supabase
        .from("user_word_progress")
        .select("word_id, status, review_count")
        .eq("user_id", userId)
        .range(from, to)
    ),
  ]);

  const wordMap = new Map<string, Word>();
  for (const row of lessonWordsNested.flat()) {
    const word = Array.isArray(row.words) ? row.words[0] : row.words;
    if (word && !wordMap.has(word.id)) {
      wordMap.set(word.id, word);
    }
  }

  const words = Array.from(wordMap.values());
  if (words.length === 0) return [];

  const progressMap = new Map<
    string,
    { status: ProgressStatus; review_count: number }
  >();
  for (const row of progressRows) {
    progressMap.set(row.word_id, {
      status: row.status,
      review_count: row.review_count,
    });
  }

  words.sort((a, b) => {
    if (a.frequency_rank !== b.frequency_rank) {
      return a.frequency_rank - b.frequency_rank;
    }
    return a.turkish.localeCompare(b.turkish, "tr-TR");
  });

  return words.map((word) => {
    const prog = progressMap.get(word.id);
    return {
      ...word,
      status: prog?.status ?? "unlearned",
      review_count: prog?.review_count ?? 0,
    };
  });
}

export async function getCourseStudyData(
  supabase: SupabaseClient,
  userId: string,
  courseCode: string
): Promise<{ course: Course; words: StudyWord[] } | null> {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, code, title, description, sort_order, is_published")
    .eq("code", courseCode.toUpperCase())
    .eq("is_published", true)
    .maybeSingle();

  if (courseError) throw new Error(courseError.message);
  if (!course) return null;

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", course.id);

  if (lessonsError) throw new Error(lessonsError.message);

  const lessonIds = (lessons ?? []).map((l) => l.id as string);
  const words = await loadStudyWordsForLessonIds(supabase, userId, lessonIds);

  return { course: course as Course, words };
}

export async function getLessonStudyData(
  supabase: SupabaseClient,
  userId: string,
  courseCode: string,
  unitNumber: number
): Promise<{ course: Course; lesson: Lesson; words: StudyWord[] } | null> {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, code, title, description, sort_order, is_published")
    .eq("code", courseCode.toUpperCase())
    .eq("is_published", true)
    .maybeSingle();

  if (courseError) throw new Error(courseError.message);
  if (!course) return null;

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, course_id, unit_number, title, sort_order")
    .eq("course_id", course.id)
    .eq("unit_number", unitNumber)
    .maybeSingle();

  if (lessonError) throw new Error(lessonError.message);
  if (!lesson) return null;

  const words = await loadStudyWordsForLessonIds(supabase, userId, [
    lesson.id,
  ]);

  return {
    course: course as Course,
    lesson: lesson as Lesson,
    words,
  };
}
