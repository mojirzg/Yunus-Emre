/**
 * Builds data/source/units/a2.json from the verbatim page transcriptions in
 * data/source/pages/pNN.json, and reports differences against the previous
 * unit lists plus any words still missing a translation.
 *
 * Usage: npx tsx scripts/build-units-from-pages.ts [--previous <dir>]
 */
import fs from "node:fs";
import path from "node:path";

const PAGES_DIR = path.resolve("data/source/pages");
const UNITS_DIR = path.resolve("data/source/units");
const TRANSLATIONS_DIR = path.resolve("data/source/translations");
const OUT_FILE = path.join(UNITS_DIR, "a2.json");
const MISSING_FILE = path.resolve("data/source/missing-translations.json");
const REPORT_FILE = path.resolve("data/source/units-diff-report.json");

const norm = (s: string) =>
  s.normalize("NFC").replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim();

function readPrevious(dir: string): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>();
  if (!fs.existsSync(dir)) return map;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Record<string, string[]>;
    for (const [u, words] of Object.entries(raw)) {
      const set = map.get(Number(u)) ?? new Set<string>();
      words.forEach((w) => set.add(norm(w)));
      map.set(Number(u), set);
    }
  }
  return map;
}

function main() {
  const prevArgIdx = process.argv.indexOf("--previous");
  const previousDir = prevArgIdx > -1 ? path.resolve(process.argv[prevArgIdx + 1]) : "";

  const pageFiles = fs
    .readdirSync(PAGES_DIR)
    .filter((f) => /^p\d+\.json$/.test(f))
    .sort();
  if (pageFiles.length !== 14) {
    throw new Error(`Expected 14 page files, found ${pageFiles.length}`);
  }

  const units = new Map<number, string[]>();
  let current = 0;
  const problems: string[] = [];

  for (const file of pageFiles) {
    const page = JSON.parse(fs.readFileSync(path.join(PAGES_DIR, file), "utf8")) as {
      columns: string[][];
    };
    for (const col of page.columns) {
      for (const rawEntry of col) {
        const entry = norm(rawEntry);
        if (!entry) continue;
        const heading = entry.match(/^Ünite\s*(\d+)$/i);
        if (heading) {
          current = Number(heading[1]);
          if (!units.has(current)) units.set(current, []);
          continue;
        }
        if (current === 0) {
          problems.push(`${file}: entry before first unit heading: "${entry}"`);
          continue;
        }
        if (/-$/.test(entry)) problems.push(`${file}: unjoined hyphenation "${entry}"`);
        if (/[^\p{Script=Latin}\s.,'!?()\-/0-9]/u.test(entry)) {
          problems.push(`${file}: unexpected characters in "${entry}"`);
        }
        units.get(current)!.push(entry);
      }
    }
  }

  const out: Record<string, string[]> = {};
  const summary: Record<string, { printed: number; unique: number }> = {};
  for (const [u, list] of [...units.entries()].sort((a, b) => a[0] - b[0])) {
    const unique = Array.from(new Set(list));
    out[String(u)] = unique;
    summary[`Ünite ${u}`] = { printed: list.length, unique: unique.length };
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf8");

  // Translations coverage
  const translated = new Set<string>();
  if (fs.existsSync(TRANSLATIONS_DIR)) {
    for (const f of fs.readdirSync(TRANSLATIONS_DIR).filter((f) => f.endsWith(".json"))) {
      const items = JSON.parse(fs.readFileSync(path.join(TRANSLATIONS_DIR, f), "utf8")) as {
        turkish: string;
      }[];
      items.forEach((i) => translated.add(norm(i.turkish)));
    }
  }
  const allWords = new Set(Object.values(out).flat());
  const missing = [...allWords].filter((w) => !translated.has(w)).sort((a, b) => a.localeCompare(b, "tr"));
  fs.writeFileSync(MISSING_FILE, JSON.stringify(missing, null, 2), "utf8");

  // Diff against previous unit lists
  const report: Record<string, { added: string[]; removed: string[] }> = {};
  if (previousDir) {
    const prev = readPrevious(previousDir);
    for (const [u, list] of Object.entries(out)) {
      const before = prev.get(Number(u)) ?? new Set<string>();
      const now = new Set(list);
      report[`Ünite ${u}`] = {
        added: list.filter((w) => !before.has(w)),
        removed: [...before].filter((w) => !now.has(w)),
      };
    }
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");
  }

  console.log("Units:", summary);
  console.log(`Unique words across course: ${allWords.size}`);
  console.log(`Missing translations: ${missing.length} -> ${MISSING_FILE}`);
  if (previousDir) {
    for (const [u, r] of Object.entries(report)) {
      console.log(`${u}: +${r.added.length} added, -${r.removed.length} removed vs previous data`);
    }
  }
  if (problems.length) {
    console.log(`Problems (${problems.length}):`);
    problems.forEach((p) => console.log("  " + p));
  }
}

main();
