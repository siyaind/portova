import assert from "node:assert/strict";
import test from "node:test";
import { encodeAddress } from "@polkadot/util-crypto";
import { blankProject } from "./project.ts";
import type { CloudProject } from "./cloud-project.ts";
import {
  cloudPublicationDraft, emptyPublicationDraft, publicationDraftKey,
  publicationSaveRevision, readPublicationDraft, writePublicationDraft,
} from "./publication-draft.ts";

const account = encodeAddress(new Uint8Array(32).fill(1), 42);
const other = encodeAddress(new Uint8Array(32).fill(2), 42);
const row: CloudProject = {
  id: "import-project", owner: account, revision: 4, published: true,
  description: "A genuine description that must survive a browser refresh.", updatedAt: "2026-11-04T15:32:00Z",
  project: { ...blankProject(), id: "import-project", name: "QA Import", assetId: "644897333", profile: { category: "Other", website: "", example: true } },
};
function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test("cloud-loaded publication fields and cloud revision survive reload with a new reader", () => {
  const storage = memoryStorage(), key = publicationDraftKey(account, row.id);
  const loaded = cloudPublicationDraft(row);
  writePublicationDraft(storage, key, loaded, loaded, true);
  const reloaded = readPublicationDraft(storage, key);
  assert.equal(reloaded.description, row.description);
  assert.equal(reloaded.published, true);
  assert.deepEqual(reloaded.profile, row.project.profile);
  assert.equal(publicationSaveRevision(reloaded), 4);
});

test("unsaved publication edits survive navigation/reload without changing their cloud base", () => {
  const storage = memoryStorage(), key = publicationDraftKey(account, row.id);
  const first = writePublicationDraft(storage, key, emptyPublicationDraft(), cloudPublicationDraft(row));
  writePublicationDraft(storage, key, first, { ...first, description: "Edited locally", published: false, profile: { category: "Developer tools", website: "https://example.com", example: true } });
  const reloaded = readPublicationDraft(storage, key);
  assert.equal(reloaded.description, "Edited locally");
  assert.equal(reloaded.published, false);
  assert.equal(reloaded.profile.website, "https://example.com");
  assert.equal(reloaded.profile.category, "Developer tools");
  assert.equal(reloaded.cloudRevision, 4);
  assert.equal(row.description, "A genuine description that must survive a browser refresh.");
});

test("wallets and projects cannot inherit each other's cached description or publication setting", () => {
  const storage = memoryStorage(), key = publicationDraftKey(account, row.id);
  writePublicationDraft(storage, key, emptyPublicationDraft(), cloudPublicationDraft(row));
  for (const isolated of [publicationDraftKey(other, row.id), publicationDraftKey(account, "other-project")]) {
    const draft = readPublicationDraft(storage, isolated);
    assert.equal(draft.description, "");
    assert.equal(draft.published, false);
    assert.equal(publicationSaveRevision(draft), null);
  }
  // Alternative SS58 display prefixes for the same account share one cache.
  assert.equal(publicationDraftKey(encodeAddress(new Uint8Array(32).fill(1), 0), row.id), key);
});

test("legacy blank defaults cannot supply an update revision; stale cloud versions require reload", () => {
  assert.equal(publicationSaveRevision(emptyPublicationDraft(row.project.profile), row), null);
  const loaded = cloudPublicationDraft(row);
  assert.equal(publicationSaveRevision(loaded, row), 4);
  assert.equal(publicationSaveRevision(loaded, { ...row, revision: 5 }), null);
  assert.equal(publicationSaveRevision({ ...emptyPublicationDraft(), cloudRevision: 0 }), 0);
  assert.equal(publicationSaveRevision({ ...emptyPublicationDraft(), cloudRevision: 0 }, row), null);
});

test("a stale tab cannot overwrite a newer browser draft; explicit cloud reload can replace it", () => {
  const storage = memoryStorage(), key = publicationDraftKey(account, row.id);
  const first = writePublicationDraft(storage, key, emptyPublicationDraft(), cloudPublicationDraft(row));
  const stale = readPublicationDraft(storage, key);
  const latest = writePublicationDraft(storage, key, first, { ...first, description: "Newer tab" });
  assert.notEqual(latest.localVersion, stale.localVersion);
  assert.throws(() => writePublicationDraft(storage, key, stale, { ...stale, description: "Stale overwrite" }), /another tab/);
  assert.equal(readPublicationDraft(storage, key).description, "Newer tab");
  writePublicationDraft(storage, key, stale, cloudPublicationDraft(row), true);
  assert.equal(readPublicationDraft(storage, key).description, row.description);
});

test("invalid data and unavailable storage do not silently become a saveable blank cloud draft", () => {
  const storage = memoryStorage(), key = publicationDraftKey(account, row.id);
  storage.setItem(key, JSON.stringify({ ...cloudPublicationDraft(row), localVersion: "id", published: "false" }));
  assert.throws(() => readPublicationDraft(storage, key), /invalid/);
  storage.setItem(key, "broken");
  assert.throws(() => readPublicationDraft(storage, key));
  const denied = { getItem: () => null, setItem: () => { throw Error("quota"); } };
  assert.throws(() => writePublicationDraft(denied, key, emptyPublicationDraft(), cloudPublicationDraft(row)), /quota/);
  assert.equal(publicationSaveRevision(readPublicationDraft(denied, key)), null);
});
