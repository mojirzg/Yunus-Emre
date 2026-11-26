import fs from "node:fs";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

interface TextChunk {
  str: string;
  x: number;
  y: number;
}

interface ExtractedEntry {
  unit_number: number;
  turkish: string;
}

const PDF_PATH = path.resolve(process.cwd(), "data/source/a2-vocab.pdf");
const OUT_PATH = path.resolve(process.cwd(), "data/source/a2-raw-extracted.json");

function isHeaderOrFooter(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^(A2|DİZİN|DIZIN)$/i.test(t)) return true;
  if (/^\d{3}$/.test(t)) return true; // page numbers 172..185
  if (/YEDİ\s+İKLİM\s+TÜRKÇE/i.test(t)) return true;
  if (/^Dizin$/i.test(t)) return true;
  if (/^[•·●▪▫\-–—]+$/.test(t)) return true;
  return false;
}

function cleanText(raw: string): string {
  // Remove stray Arabic/control/garbage characters while preserving Turkish Latin + spaces + punctuation
  return raw
    .normalize("NFC")
    .replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u200B-\u200F\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}\s.,!?'"()\-/]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clusterColumns(items: TextChunk[]): TextChunk[][] {
  if (items.length === 0) return [];
  // Sort by x ascending to inspect column boundaries dynamically
  const sortedX = [...items].sort((a, b) => a.x - b.x);
  const columns: TextChunk[][] = [];

  for (const item of sortedX) {
    const lastCol = columns[columns.length - 1];
    if (!lastCol) {
      columns.push([item]);
      continue;
    }
    const colMinX = Math.min(...lastCol.map((c) => c.x));
    // Columns on these 5-column pages are ~100pt apart; threshold 55pt cleanly separates them
    if (Math.abs(item.x - colMinX) < 55) {
      lastCol.push(item);
    } else {
      columns.push([item]);
    }
  }

  // Sort each column top-to-bottom (higher PDF y = higher on page)
  for (const col of columns) {
    col.sort((a, b) => {
      if (Math.abs(b.y - a.y) > 2.5) return b.y - a.y;
      return a.x - b.x;
    });
  }

  return columns;
}

function mergeLinesInColumn(col: TextChunk[]): string[] {
  const lines: TextChunk[][] = [];
  for (const item of col) {
    const lastLine = lines[lines.length - 1];
    if (lastLine && Math.abs(lastLine[0].y - item.y) <= 2.5) {
      lastLine.push(item);
    } else {
      lines.push([item]);
    }
  }

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      let joined = "";
      for (let i = 0; i < line.length; i++) {
        const chunk = line[i];
        if (i === 0) {
          joined = chunk.str;
        } else {
          const prev = line[i - 1];
          const needsSpace =
            !joined.endsWith(" ") &&
            !chunk.str.startsWith(" ") &&
            chunk.x - prev.x > 4;
          joined += (needsSpace ? " " : "") + chunk.str;
        }
      }
      return cleanText(joined);
    })
    .filter((line) => line.length > 0 && !isHeaderOrFooter(line));
}

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`PDF not found at ${PDF_PATH}`);
  }

  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const loadingTask = pdfjsLib.getDocument({ data, verbosity: 0 });
  const pdf = await loadingTask.promise;

  console.log(`Loaded PDF with ${pdf.numPages} pages. Extracting pages 1..14...`);

  const maxPage = Math.min(14, pdf.numPages);
  let currentUnit = 1;
  const rawByUnit: Record<number, string[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
    8: [],
  };

  for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const chunks: TextChunk[] = [];
    for (const item of textContent.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const tx = item.transform;
      const x = tx[4];
      const y = tx[5];
      // Skip top/bottom margins containing A2 DİZİN banner or page footer
      if (y > viewport.height - 65 || y < 55) continue;
      chunks.push({ str: item.str, x, y });
    }

    const columns = clusterColumns(chunks);
    const orderedLines: string[] = [];
    for (const col of columns) {
      orderedLines.push(...mergeLinesInColumn(col));
    }

    // Join hyphenated wraps and multi-line wrapped entries within page column flow
    for (let i = 0; i < orderedLines.length; i++) {
      let line = orderedLines[i];

      const unitMatch = line.match(/^Ünite\s*(\d+)$/i);
      if (unitMatch) {
        currentUnit = Number.parseInt(unitMatch[1], 10);
        continue;
      }

      // Handle hyphenated word break across lines, e.g. "ekmek kızartma maki-" + "nesi"
      while (line.endsWith("-") && i + 1 < orderedLines.length) {
        const next = orderedLines[i + 1];
        if (/^Ünite\s*\d+$/i.test(next)) break;
        line = line.slice(0, -1) + next;
        i += 1;
      }

      // Handle wrapped multi-word phrase where the second line is a lowercase/title continuation
      // only for known multi-line cases (starts with lowercase/suffix or 've ' / 'Öğretimi' / 'Enstitüsü' etc.)
      if (
        i + 1 < orderedLines.length &&
        (line.endsWith(" ve") ||
          /^(Öğretimi|Enstitüsü|nesi|stitüsü)$/i.test(orderedLines[i + 1]))
      ) {
        line = `${line} ${orderedLines[i + 1]}`;
        i += 1;
      }

      const cleaned = cleanText(line);
      if (cleaned && !isHeaderOrFooter(cleaned)) {
        rawByUnit[currentUnit]?.push(cleaned);
      }
    }
  }

  const entries: ExtractedEntry[] = [];
  for (let u = 1; u <= 8; u++) {
    const seen = new Set<string>();
    const list = rawByUnit[u] ?? [];
    for (const term of list) {
      if (!seen.has(term)) {
        seen.add(term);
        entries.push({ unit_number: u, turkish: term });
      }
    }
    console.log(`Ünite ${u}: ${seen.size} entries`);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({ entries, rawByUnit }, null, 2), "utf8");
  console.log(`Total extracted entries: ${entries.length} -> ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
