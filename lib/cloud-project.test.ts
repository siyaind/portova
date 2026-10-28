import test from "node:test";
import assert from "node:assert/strict";
import { validateProjectRequest, projectSignMessage } from "./cloud-project.ts";
test("cloud writes reject invalid revision and malformed project records", () => {
  assert.throws(() => validateProjectRequest({ action: "save", project: null, revision: 0 }), /valid local project/);
  assert.throws(() => validateProjectRequest({ action: "save", project: { id: "p", name: "P", assetId: "", collectionId: "", poolLpToken: "", proceeds: "" }, revision: -1 }), /valid local project/);
});
test("storage signatures bind the site, action, account, expiry, nonce and exact payload digest", () => {
  const message = projectSignMessage("https://portova.vercel.app", "alice", "nonce-a", "expires-a", "digest-a", "save");
  for (const value of ["https://portova.vercel.app", "alice", "nonce-a", "expires-a", "digest-a", "save"]) assert.ok(message.includes(value));
  assert.notEqual(message, projectSignMessage("https://evil.example", "alice", "nonce-a", "expires-a", "digest-a", "save"));
  assert.notEqual(message, projectSignMessage("https://portova.vercel.app", "alice", "nonce-a", "expires-a", "digest-b", "save"));
});

test("real signatures reject a different owner, nonce or payload", async () => {
  const { cryptoWaitReady, ed25519PairFromSeed, ed25519Sign, signatureVerify } = await import("@polkadot/util-crypto");
  const { stringToU8a } = await import("@polkadot/util");
  await cryptoWaitReady();
  const pair = ed25519PairFromSeed(new Uint8Array(32).fill(7));
  const other = ed25519PairFromSeed(new Uint8Array(32).fill(8));
  const message = projectSignMessage("https://portova.vercel.app", "owner", "nonce", "expiry", "payload", "save");
  const signature = ed25519Sign(stringToU8a(message), pair);
  assert.equal(signatureVerify(message, signature, pair.publicKey).isValid, true);
  assert.equal(signatureVerify(message, signature, other.publicKey).isValid, false);
  assert.equal(signatureVerify(message.replace("nonce", "changed"), signature, pair.publicKey).isValid, false);
  assert.equal(signatureVerify(message.replace("payload", "changed"), signature, pair.publicKey).isValid, false);
});
