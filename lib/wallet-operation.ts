import { signAndSend, type TxUpdate } from "./assets.ts";
import { sameAccount } from "./withdrawal.ts";
import { feeReviewFor } from "./fee-evidence.ts";

export type WalletOperationContext = {
  account: string | null; source: string | null; genesisHash: string | null;
  runtime: string | null; live: boolean; draft: string; revision: number;
};
export function operationDraft(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => typeof entry === "bigint" ? entry.toString() : entry);
}
export function walletOperation(origin: WalletOperationContext, read: () => WalletOperationContext) {
  const original = { ...origin };
  const current = () => {
    const next = read();
    return original.live && next.live && !!original.account && !!original.source && !!original.genesisHash
      && sameAccount(original.account, next.account) && original.source === next.source
      && original.genesisHash === next.genesisHash && original.runtime === next.runtime
      && original.draft === next.draft && original.revision === next.revision;
  };
  return { current, assertCurrent() { if (!current()) throw Object.assign(new Error("The wallet, network, or reviewed inputs changed. Nothing was submitted. Review again."), { notBroadcast: true }); } };
}

/** A signature may be obtained only for the originating context, then rechecked before send. */
export async function guardedSignAndSend(
  operation: ReturnType<typeof walletOperation>,
  args: Parameters<typeof signAndSend>,
): Promise<TxUpdate> {
  operation.assertCurrent();
  const [api, tx, address, signer, onUpdate, decorate, validate] = args;
  const feeReview = feeReviewFor(tx);
  return signAndSend(api, tx, address, signer, update => onUpdate({ account: address, genesisHash: api.genesisHash?.toHex(), ...feeReview, ...update }), decorate, async () => {
    if (!operation.current()) return false;
    const valid = validate ? await validate() : true;
    return valid && operation.current();
  });
}
