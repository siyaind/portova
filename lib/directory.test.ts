import test from "node:test";
import assert from "node:assert/strict";
import {
  isExampleAsset,
  isExampleProject,
  safeWebsite,
  directoryReady,
} from "./directory.ts";
import { blankProject, parseProject } from "./project.ts";
test("example attribution requires a known object identity on the correct network", () => {
  assert.equal(isExampleAsset("9192"), true);
  assert.equal(isExampleAsset("9192", "another-network"), false);
  assert.equal(
    isExampleProject({
      ...blankProject(),
      name: "Portova test",
      assetId: "999",
    }),
    false,
  );
  assert.equal(
    isExampleProject({
      ...blankProject(),
      profile: { category: "Other", website: "", example: true },
    }),
    true,
  );
});
test("publisher website URLs cannot execute scripts or include credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:pass@example.com",
    "not a URL",
  ])
    assert.equal(safeWebsite(url), null);
  assert.equal(safeWebsite("https://example.com"), "https://example.com/");
  assert.equal(
    parseProject(
      JSON.stringify({
        ...blankProject(),
        name: "Project",
        profile: { category: "Invented", website: "", example: false },
      }),
    ),
    null,
  );
});
test("directory eligibility needs useful content and at least one linked object", () => {
  assert.equal(
    directoryReady({ ...blankProject(), assetId: "1" }, "short"),
    false,
  );
  assert.equal(
    directoryReady(
      blankProject(),
      "A complete description of the community project.",
    ),
    false,
  );
  assert.equal(
    directoryReady(
      { ...blankProject(), assetId: "1" },
      "A complete description of the community project.",
    ),
    true,
  );
});
