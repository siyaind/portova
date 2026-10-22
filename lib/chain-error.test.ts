import assert from "node:assert/strict";
import test from "node:test";
import { plainChainError } from "./chain-error.ts";

test("a token error JSON becomes a sentence", () => {
  assert.equal(
    plainChainError('{"token":"FundsUnavailable"}'),
    "The account does not have enough free balance for this call.",
  );
});
