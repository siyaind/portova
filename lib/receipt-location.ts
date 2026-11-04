import type { ApiPromise } from "@polkadot/api";

/** Resolve the receipt's actual block, never the current head. Failure leaves it unknown. */
export async function receiptBlockNumber(api: ApiPromise, blockHash: string): Promise<number | undefined> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(blockHash)) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const header = await Promise.race([
      api.rpc.chain.getHeader(blockHash),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("Block lookup timed out")), 5000); }),
    ]);
    const height = Number(header.number.toString());
    return Number.isSafeInteger(height) && height >= 0 ? height : undefined;
  } catch { return undefined; }
  finally { clearTimeout(timer); }
}
