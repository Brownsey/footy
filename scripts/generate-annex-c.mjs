import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PDFParse } from "pdf-parse";

const PDF_PATH = "resources/FWC2026_regulations_EN.pdf";
const OUTPUT_PATH = "src/data/annexCThirdPlaceAllocation.json";
const THIRD_PLACE_SLOTS = ["1A", "1B", "1D", "1E", "1G", "1I", "1K", "1L"];
const ANNEX_C_PAGE_START = 79;
const ANNEX_C_PAGE_END_EXCLUSIVE = 97;
const ROW_PATTERN = /^(\d{1,3})\s+((?:3[A-L]\s*){8})$/;

const pdf = await readFile(PDF_PATH);
const parser = new PDFParse({ data: pdf });

try {
  const parsed = await parser.getText();
  const annexText = parsed.pages
    .slice(ANNEX_C_PAGE_START, ANNEX_C_PAGE_END_EXCLUSIVE)
    .map((page) => page.text)
    .join("\n");

  const allocations = {};

  for (const line of annexText.split(/\r?\n/)) {
    const match = line.trim().match(ROW_PATTERN);
    if (!match) continue;

    const option = Number(match[1]);
    const values = match[2].trim().split(/\s+/);
    const groups = values.map((value) => value.slice(1)).sort();
    const key = groups.join("");

    allocations[key] = {
      option,
      slots: Object.fromEntries(
        THIRD_PLACE_SLOTS.map((slot, index) => [slot, values[index].slice(1)]),
      ),
    };
  }

  const count = Object.keys(allocations).length;
  if (count !== 495) {
    throw new Error(`Expected 495 Annexe C allocations, found ${count}`);
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        source:
          "FIFA World Cup 26 Regulations, May 2026, Annexe C. Extracted from resources/FWC2026_regulations_EN.pdf.",
        slots: THIRD_PLACE_SLOTS,
        allocations,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Generated ${OUTPUT_PATH} with ${count} allocations.`);
} finally {
  await parser.destroy();
}
