import fs from "node:fs";
import path from "node:path";

interface TranslationItem {
  turkish: string;
  english: string;
  persian: string;
  frequency_rank: number;
  type?: string;
}

interface CourseOutput {
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
    type?: string;
  }[];
}

const UNITS_DIR = path.resolve(process.cwd(), "data/source/units");
const TRANSLATIONS_DIR = path.resolve(process.cwd(), "data/source/translations");
const OUT_FILE = path.resolve(process.cwd(), "data/courses/a2.json");

function main() {
  const translationMap = new Map<string, TranslationItem>();
  const transFiles = fs
    .readdirSync(TRANSLATIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  for (const file of transFiles) {
    const items = JSON.parse(
      fs.readFileSync(path.join(TRANSLATIONS_DIR, file), "utf8")
    ) as TranslationItem[];
    for (const item of items) {
      const key = item.turkish.normalize("NFC").replace(/\s+/g, " ").trim();
      translationMap.set(key, {
        turkish: key,
        english: item.english.normalize("NFC").trim(),
        persian: item.persian.normalize("NFC").trim(),
        frequency_rank: Math.max(1, Math.round(item.frequency_rank)),
        ...(item.type ? { type: item.type } : {}),
      });
    }
  }

  const unitFiles = fs
    .readdirSync(UNITS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const unitMap = new Map<number, string[]>();
  for (const file of unitFiles) {
    const raw = JSON.parse(
      fs.readFileSync(path.join(UNITS_DIR, file), "utf8")
    ) as Record<string, string[]>;
    for (const [unitStr, words] of Object.entries(raw)) {
      const unitNumber = Number.parseInt(unitStr, 10);
      const deduped = Array.from(
        new Set(words.map((w) => w.normalize("NFC").replace(/\s+/g, " ").trim()))
      ).filter(Boolean);
      unitMap.set(unitNumber, deduped);
    }
  }

  const missing: string[] = [];
  const invalid: string[] = [];
  const entries: CourseOutput["entries"] = [];

  const unitNumbers = Array.from(unitMap.keys()).sort((a, b) => a - b);
  for (const unitNumber of unitNumbers) {
    const words = unitMap.get(unitNumber) ?? [];
    for (const turkish of words) {
      const tr = translationMap.get(turkish);
      if (!tr) {
        missing.push(turkish);
        continue;
      }
      if (
        !tr.english ||
        !tr.persian ||
        !Number.isInteger(tr.frequency_rank) ||
        tr.frequency_rank < 1 ||
        /-\s*$/.test(tr.turkish)
      ) {
        invalid.push(turkish);
        continue;
      }
      entries.push({
        unit_number: unitNumber,
        turkish: tr.turkish,
        english: tr.english,
        persian: tr.persian,
        frequency_rank: tr.frequency_rank,
        ...(tr.type ? { type: tr.type } : {}),
      });
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    console.error(`Missing translations (${missing.length}):`, missing.slice(0, 20));
    console.error(`Invalid entries (${invalid.length}):`, invalid.slice(0, 20));
    process.exit(1);
  }

  const output: CourseOutput = {
    course: {
      code: "A2",
      title: "Yedi İklim Türkçe A2",
      description:
        "Elementary Turkish vocabulary from Yedi İklim Türkçe A2 Ders Kitabı (Ünite 1–8), ordered by everyday spoken frequency.",
      sort_order: 1,
      is_published: true,
    },
    lessons: unitNumbers.map((u) => ({
      unit_number: u,
      title: `Ünite ${u}`,
      sort_order: u,
    })),
    entries,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf8");

  const uniqueWords = new Set(entries.map((e) => e.turkish));
  console.log(
    `Built ${OUT_FILE}: ${output.lessons.length} lessons, ${entries.length} lesson-word links, ${uniqueWords.size} unique words.`
  );
}

main();
