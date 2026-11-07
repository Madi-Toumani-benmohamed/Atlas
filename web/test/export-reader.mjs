// Run the independent Python reader against the actual private API download.
// Keep only synthetic test data in a private temporary directory, then remove it.
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

export async function inspectExport(raw) {
  const directory = await mkdtemp(join(tmpdir(), "atlas-export-reader-"));
  const file = join(directory, "synthetic.json");
  try {
    await writeFile(file, raw, { mode: 0o600 });
    const result = execFileSync("python3", [
      fileURLToPath(new URL("../../scripts/read-export.py", import.meta.url)),
      "--journal", file,
    ], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    assert.equal(await readFile(file, "utf8"), raw, "Reader must preserve the original export");
    const inspection = JSON.parse(result);
    console.log("PASS: independent offline Python reader accepted the real exported JSON; source unchanged.");
    return inspection;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
