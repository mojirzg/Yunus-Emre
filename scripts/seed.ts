import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

interface CourseFile {
  course: {
    code: string;
    title: string;
    description: string;
    sort_order: number;
    is_published: boolean;
  };
  lessons: {
    unit_number: number;
    title: string;
    sort_order: number;
  }[];
  entries: {
    unit_number: number;
    turkish: string;
    english: string;
    persian: string;
    frequency_rank: number;
  }[];
}

const COURSES_DIR = path.resolve(process.cwd(), "data/courses");
const BATCH_SIZE = 500;

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function validateCourseFile(fileName: string, data: CourseFile) {
  if (!data.course?.code || !data.course?.title) {
    throw new Error(`${fileName}: missing course.code or course.title`);
  }
  if (!Array.isArray(data.lessons) || data.lessons.length === 0) {
    throw new Error(`${fileName}: lessons array is empty`);
  }
  if (!Array.isArray(data.entries) || data.entries.length === 0) {
    throw new Error(`${fileName}: entries array is empty`);
  }

  const validUnits = new Set(data.lessons.map((l) => l.unit_number));
  for (let i = 0; i < data.entries.length; i++) {
    const e = data.entries[i];
    if (!validUnits.has(e.unit_number)) {
      throw new Error(
        `${fileName} entry #${i}: invalid unit_number ${e.unit_number}`
      );
    }
    if (!e.turkish?.trim() || !e.english?.trim() || !e.persian?.trim()) {
      throw new Error(
        `${fileName} entry #${i}: empty turkish/english/persian (${e.turkish})`
      );
    }
    if (!Number.isInteger(e.frequency_rank) || e.frequency_rank < 1) {
      throw new Error(
        `${fileName} entry #${i}: invalid frequency_rank ${e.frequency_rank}`
      );
    }
  }
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  if (!fs.existsSync(COURSES_DIR)) {
    throw new Error(`Courses directory not found: ${COURSES_DIR}`);
  }

  const files = fs
    .readdirSync(COURSES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No course JSON files found in ${COURSES_DIR}`);
  }

  const parsedCourses: { fileName: string; data: CourseFile }[] = [];
  for (const fileName of files) {
    const fullPath = path.join(COURSES_DIR, fileName);
    const data = JSON.parse(fs.readFileSync(fullPath, "utf8")) as CourseFile;
    validateCourseFile(fileName, data);
    parsedCourses.push({ fileName, data });
  }

  if (isDryRun) {
    for (const { fileName, data } of parsedCourses) {
      const uniqueWords = new Set(
        data.entries.map((e) => e.turkish.normalize("NFC").trim())
      );
      const unitCounts = new Map<number, number>();
      for (const e of data.entries) {
        unitCounts.set(e.unit_number, (unitCounts.get(e.unit_number) ?? 0) + 1);
      }
      console.log(
        `[DRY RUN] ${fileName}: course=${data.course.code} (${data.course.title}), lessons=${data.lessons.length}, entries=${data.entries.length}, uniqueWords=${uniqueWords.size}`
      );
      for (const lesson of data.lessons) {
        console.log(
          `  - ${lesson.title} (unit ${lesson.unit_number}): ${unitCounts.get(lesson.unit_number) ?? 0} words`
        );
      }
    }
    console.log("[DRY RUN] All course JSON files validated successfully.");
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment (.env.local)."
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const { fileName, data } of parsedCourses) {
    console.log(`Seeding ${fileName} (${data.course.code})...`);

    // 1. Upsert course
    const { data: courseRow, error: courseError } = await supabase
      .from("courses")
      .upsert(
        {
          code: data.course.code.trim().toUpperCase(),
          title: data.course.title.normalize("NFC").trim(),
          description: data.course.description.normalize("NFC").trim(),
          sort_order: data.course.sort_order,
          is_published: data.course.is_published,
        },
        { onConflict: "code" }
      )
      .select("id, code")
      .single();

    if (courseError || !courseRow) {
      throw new Error(`Course upsert failed: ${courseError?.message}`);
    }

    // 2. Upsert lessons
    const lessonPayload = data.lessons.map((l) => ({
      course_id: courseRow.id,
      unit_number: l.unit_number,
      title: l.title.normalize("NFC").trim(),
      sort_order: l.sort_order,
    }));

    const { data: lessonRows, error: lessonsError } = await supabase
      .from("lessons")
      .upsert(lessonPayload, { onConflict: "course_id,unit_number" })
      .select("id, unit_number");

    if (lessonsError || !lessonRows) {
      throw new Error(`Lessons upsert failed: ${lessonsError?.message}`);
    }

    const lessonIdByUnit = new Map<number, string>();
    for (const row of lessonRows) {
      lessonIdByUnit.set(row.unit_number as number, row.id as string);
    }

    // 3. Deduplicate normalized words globally before upserting
    const uniqueWordMap = new Map<
      string,
      {
        turkish: string;
        english: string;
        persian: string;
        frequency_rank: number;
      }
    >();

    for (const entry of data.entries) {
      const normalizedTurkish = entry.turkish
        .normalize("NFC")
        .replace(/\s+/g, " ")
        .trim();
      const existing = uniqueWordMap.get(normalizedTurkish);
      if (!existing || entry.frequency_rank < existing.frequency_rank) {
        uniqueWordMap.set(normalizedTurkish, {
          turkish: normalizedTurkish,
          english: entry.english.normalize("NFC").trim(),
          persian: entry.persian.normalize("NFC").trim(),
          frequency_rank: entry.frequency_rank,
        });
      }
    }

    const wordRecords = Array.from(uniqueWordMap.values());
    const wordIdByTurkish = new Map<string, string>();

    for (const batch of chunkArray(wordRecords, BATCH_SIZE)) {
      const { data: upsertedWords, error: wordsError } = await supabase
        .from("words")
        .upsert(batch, { onConflict: "turkish" })
        .select("id, turkish");

      if (wordsError || !upsertedWords) {
        throw new Error(`Words upsert failed: ${wordsError?.message}`);
      }

      for (const row of upsertedWords) {
        wordIdByTurkish.set(row.turkish as string, row.id as string);
      }
    }

    // 4. Upsert lesson_words links
    const linkKeySet = new Set<string>();
    const lessonWordLinks: { lesson_id: string; word_id: string }[] = [];

    for (const entry of data.entries) {
      const lessonId = lessonIdByUnit.get(entry.unit_number);
      const normalizedTurkish = entry.turkish
        .normalize("NFC")
        .replace(/\s+/g, " ")
        .trim();
      const wordId = wordIdByTurkish.get(normalizedTurkish);

      if (!lessonId || !wordId) {
        throw new Error(
          `Missing lessonId or wordId for unit ${entry.unit_number}, word "${normalizedTurkish}"`
        );
      }

      const key = `${lessonId}:${wordId}`;
      if (!linkKeySet.has(key)) {
        linkKeySet.add(key);
        lessonWordLinks.push({ lesson_id: lessonId, word_id: wordId });
      }
    }

    for (const batch of chunkArray(lessonWordLinks, BATCH_SIZE)) {
      const { error: linkError } = await supabase
        .from("lesson_words")
        .upsert(batch, { onConflict: "lesson_id,word_id" });

      if (linkError) {
        throw new Error(`lesson_words upsert failed: ${linkError.message}`);
      }
    }

    // 5. Remove stale lesson_words rows for this course's lessons that are no longer in the JSON
    const lessonIds = Array.from(lessonIdByUnit.values());
    let removedLinks = 0;
    for (const lessonId of lessonIds) {
      const { data: existingRows, error: fetchLinksError } = await supabase
        .from("lesson_words")
        .select("word_id")
        .eq("lesson_id", lessonId);
      if (fetchLinksError) {
        throw new Error(`Failed reading lesson_words: ${fetchLinksError.message}`);
      }
      const staleWordIds = (existingRows ?? [])
        .map((r) => r.word_id as string)
        .filter((wordId) => !linkKeySet.has(`${lessonId}:${wordId}`));

      for (const staleBatch of chunkArray(staleWordIds, 100)) {
        const { error: deleteError } = await supabase
          .from("lesson_words")
          .delete()
          .eq("lesson_id", lessonId)
          .in("word_id", staleBatch);
        if (deleteError) {
          throw new Error(`Failed deleting stale lesson_words: ${deleteError.message}`);
        }
        removedLinks += staleBatch.length;
      }
    }

    console.log(
      `Seeded ${data.course.code}: ${lessonRows.length} lessons, ${wordRecords.length} unique words, ${lessonWordLinks.length} lesson-word links (pruned ${removedLinks} stale links).`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
