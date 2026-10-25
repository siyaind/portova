import assert from "node:assert/strict";
import test from "node:test";
import { encodeAddress } from "@polkadot/util-crypto";
import { attachProjectObject, blankProject, parseProject, saveProjectVersion } from "./project.ts";
import { changeProjectRecord } from "./project-store.ts";
const actor = encodeAddress(new Uint8Array(32).fill(1), 42), other = encodeAddress(new Uint8Array(32).fill(2), 42);
const project = { ...blankProject(), id: "project-one", revision: 1, name: "Demo", proceeds: actor, launch: { kind: "token" as const, liquidity: true } };
test("a guided object attaches only to its originating project/account and never replaces a different link", () => {
  const next = attachProjectObject(project, project.id, "assetId", "9001", actor);
  assert.equal(next.assetId, "9001"); assert.equal(next.revision, 2);
  assert.throws(() => attachProjectObject(next, "project-two", "assetId", "9002", actor), /project changed/);
  assert.throws(() => attachProjectObject(next, project.id, "assetId", "9002", actor), /different object/);
  assert.throws(() => attachProjectObject(project, project.id, "assetId", "9001", other), /another account/);
  assert.equal(attachProjectObject(next, project.id, "assetId", "9001", actor), next);
});
test("project storage failures do not report a successful save or clear", () => {
  let raw = JSON.stringify(project);
  const storage = { getItem: () => raw, setItem: () => { throw Error("quota"); }, removeItem: () => { throw Error("denied"); } };
  assert.throws(() => changeProjectRecord(storage, "key", () => ({ ...project, name: "Changed" })), /quota/);
  assert.equal(JSON.parse(raw).name, "Demo");
  assert.throws(() => changeProjectRecord(storage, "key", () => null), /denied/);
  raw = "broken";
  assert.throws(() => changeProjectRecord(storage, "key", () => project), /invalid/);
});
test("legacy projects load and guided plans preserve their validated choices", () => {
  assert.equal(parseProject(JSON.stringify({ ...blankProject(), name: "Legacy" }))?.name, "Legacy");
  assert.deepEqual(parseProject(JSON.stringify(project))?.launch, { kind: "token", liquidity: true });
  assert.equal(parseProject(JSON.stringify({ ...project, launch: { kind: "nft", liquidity: true } }))?.launch?.liquidity, false);
});
test("a stale project draft cannot overwrite a newer tab or a replacement project", () => {
  const next = saveProjectVersion(project, { ...project, name: "Updated" });
  assert.equal(next.revision, 2);
  assert.throws(() => saveProjectVersion(next, project), /another tab/);
  assert.throws(() => saveProjectVersion({ ...next, id: "replacement" }, next), /another tab/);
});
