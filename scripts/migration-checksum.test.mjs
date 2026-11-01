import test from "node:test";
import assert from "node:assert/strict";
import { migrationChecksums } from "./migration-checksum.mjs";
test("migration checksums accept equivalent Windows/Linux line endings without accepting changed SQL", () => {
  const unix = migrationChecksums("CREATE TABLE example(id int);\nSELECT 1;\n");
  const windows = migrationChecksums(
    "CREATE TABLE example(id int);\r\nSELECT 1;\r\n",
  );
  assert.equal(unix.canonical, windows.canonical);
  for (const legacy of windows.compatible)
    assert.equal(unix.compatible.has(legacy), true);
  assert.equal(
    unix.compatible.has(
      migrationChecksums("CREATE TABLE example(id int);\nSELECT 2;\n")
        .canonical,
    ),
    false,
  );
});
