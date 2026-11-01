/**
 * dryrun.ts — Evidence Package module, stage 2+3 dry-run harness.
 *
 * Runs the real scanner + extractor against a case's live Drive evidence and
 * prints the Phase 2 report metrics. Page images are NOT uploaded (local only),
 * so it is read-only against Drive except for the file downloads it must do.
 *
 * Usage (from repo root, needs DB + Drive env):
 *   DEV_CASE_ID=<case_setup_id> pnpm --filter @workspace/api-server exec tsx \
 *     src/services/package/dryrun.ts
 *   # or: tsx artifacts/api-server/src/services/package/dryrun.ts <caseSetupId>
 *
 * NOTE: the argument is case_petition_setup.id (NOT a profile id).
 */

import { scanCaseEvidence } from "./scanner";
import { extractFile } from "./extractor";

function dist(values: number[]) {
  if (values.length === 0) return { count: 0 };
  const s = [...values].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  const bucket = (lo: number, hi: number) => s.filter((v) => v >= lo && v < hi).length;
  return {
    count: s.length,
    min: s[0],
    median: s[Math.floor(s.length / 2)],
    mean: Math.round((sum / s.length) * 10) / 10,
    max: s[s.length - 1],
    buckets: { "<60": bucket(-1, 60), "60-80": bucket(60, 80), "80-90": bucket(80, 90), "90-100": bucket(90, 101) },
  };
}

async function main() {
  const idArg = process.argv[2] ?? process.env.DEV_CASE_ID;
  const caseSetupId = Number(idArg);
  if (!idArg || Number.isNaN(caseSetupId)) {
    console.error("Set DEV_CASE_ID or pass a case_setup_id argument.");
    process.exit(1);
  }

  console.log(`\n=== Evidence Package dry-run — case_setup_id ${caseSetupId} ===\n`);

  const scan = await scanCaseEvidence(caseSetupId);
  console.log("Files scanned by mime type:");
  for (const [mime, n] of Object.entries(scan.byMimeType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(4)}  ${mime}`);
  }
  console.log(`  total: ${scan.files.length} file(s) across ${scan.scannedFolders} folder(s)`);
  if (scan.skippedFolders.length) {
    console.log("Skipped folders (tagged):");
    for (const f of scan.skippedFolders) console.log(`  - ${f.name}  ${f.tag}`);
  }

  console.log("\nExtracting...");
  let ok = 0;
  let pagesWritten = 0;
  const allConf: number[] = [];
  const errors: { name: string; error: string }[] = [];
  for (const f of scan.files) {
    const ex = await extractFile(f); // no upload (dry-run)
    if (ex.ok) {
      ok += 1;
      pagesWritten += ex.pages.length;
      allConf.push(...ex.ocrConfidences);
    } else {
      errors.push({ name: ex.fileName, error: ex.error ?? "unknown" });
    }
  }

  console.log(`\nExtracts written: ${ok}/${scan.files.length} ok, ${pagesWritten} page image(s) produced`);
  console.log("OCR confidence distribution:", JSON.stringify(dist(allConf)));
  if (errors.length) {
    console.log(`\nExtractor errors (${errors.length}):`);
    for (const e of errors) console.log(`  - ${e.name}: ${e.error}`);
  } else {
    console.log("\nExtractor errors: none");
  }
}

main().catch((err) => {
  console.error("dry-run failed:", err);
  process.exit(1);
});
