import fs from "node:fs";
import path from "node:path";

const UNITS_DIR = path.resolve(process.cwd(), "data/source/units");
const CHUNKS_DIR = path.resolve(process.cwd(), "data/source/chunks");
const CHUNK_SIZE = 250;

function main() {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
  const files = fs.readdirSync(UNITS_DIR).filter((f) => f.endsWith(".json")).sort();
  const uniqueSet = new Set<string>();
  const unitCounts: Record<string, number> = {};

  for (const file of files) {
    const raw = JSON.parse(
      fs.readFileSync(path.join(UNITS_DIR, file), "utf8")
    ) as Record<string, string[]>;
    for (const [unit, words] of Object.entries(raw)) {
      const cleaned = words
        .map((w) => w.normalize("NFC").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      unitCounts[unit] = new Set(cleaned).size;
      for (const word of cleaned) {
        uniqueSet.add(word);
      }
    }
  }

  const sortedUnique = Array.from(uniqueSet).sort((a, b) =>
    a.localeCompare(b, "tr-TR")
  );

  for (let i = 0; i < sortedUnique.length; i += CHUNK_SIZE) {
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
    const chunk = sortedUnique.slice(i, i + CHUNK_SIZE);
    fs.writeFileSync(
      path.join(CHUNKS_DIR, `chunk-${chunkIndex}.json`),
      JSON.stringify(chunk, null, 2),
      "utf8"
    );
  }

  console.log("Unit unique counts:", unitCounts);
  console.log(
    `Total unique Turkish words: ${sortedUnique.length} across ${Math.ceil(sortedUnique.length / CHUNK_SIZE)} chunks`
  );
}

main();
