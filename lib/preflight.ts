import type { ApiPromise } from "@polkadot/api";
import { keptAliveSpendable, largestFrozenBalance, planck } from "./balance.ts";
import { OBSERVED_FEE_SHORTFALL, feeHeadroom, guardedFee } from "./fee-evidence.ts";
import { formatUnits } from "./format.ts";

export type CheckedCall<T> = {
  ok: true;
  tx: T;
  blockHash: string;
  fee: bigint;
  spendable: bigint;
  nativeNeed: bigint;
};

export type PreflightRefusal = {
  ok: false;
  message: string;
};

type Payable<T> = T & {
  paymentInfo: (payer: string) => Promise<{ partialFee: { toString(): string } }>;
};

type AccountParts = {
  free: string | null;
  reserved: string | null;
  frozen: bigint | null;
  existentialDeposit: string | null;
};

const GUARD = "This is a guard from the finalized block, not proof the call will succeed.";

export async function reviewCall<T>(input: {
  tx: Payable<T>;
  payer: string;
  nativeDebits: Array<bigint | null>;
  finalizedHash: () => Promise<string>;
  accountAt: (blockHash: string, payer: string) => Promise<AccountParts>;
  decimals?: number;
  symbol?: string;
  feeShortfall?: bigint;
}): Promise<CheckedCall<T> | PreflightRefusal> {
  const decimals = input.decimals ?? 14;
  const symbol = input.symbol ?? "tPOT";
  let blockHash = "";
  try {
    blockHash = await input.finalizedHash();
    const account = await input.accountAt(blockHash, input.payer);
    const info = await input.tx.paymentInfo(input.payer);
    const shortfall = input.feeShortfall ?? OBSERVED_FEE_SHORTFALL;
    const fee = guardedFee(planck(info.partialFee.toString()), shortfall);
    const spendableText = keptAliveSpendable(account);
    const spendable = planck(spendableText);
    const nativeNeed = sumDebits(fee, input.nativeDebits);
    if (fee === null || spendable === null || nativeNeed === null) {
      return refuse("The fee, spendable balance, or a required deposit could not be read.");
    }
    const room = feeHeadroom(spendable, nativeNeed, shortfall);
    if (room === "short") {
      return refuse(
        `This account can spend ${shown(spendable, decimals, symbol)} after frozen funds and the existential deposit. This call needs ${shown(nativeNeed, decimals, symbol)}, including the estimated fee and the observed fee gap.`,
      );
    }
    if (room === "marginal") {
      return refuse(
        `After this estimate, less than ${shown(shortfall, decimals, symbol)} would remain. The largest measured fee gap is ${shown(shortfall, decimals, symbol)} from two included calls, and that is not a maximum.`,
      );
    }
    return { ok: true, tx: input.tx, blockHash, fee, spendable, nativeNeed };
  } catch {
    return refuse(blockHash ? "The fee check could not be read." : "The finalized block could not be read.");
  }
}

export async function reviewExtrinsic<T>(
  api: ApiPromise,
  tx: Payable<T>,
  payer: string,
  nativeDebits: Array<bigint | null>,
  blockHash?: string,
): Promise<CheckedCall<T> | PreflightRefusal> {
  return reviewCall({
    tx,
    payer,
    nativeDebits,
    finalizedHash: async () => {
      if (blockHash && /^0x[0-9a-fA-F]{64}$/.test(blockHash)) return blockHash;
      const hash = (await api.rpc.chain.getFinalizedHead()).toHex();
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("The finalized block hash could not be read.");
      return hash;
    },
    accountAt: async (hash, who) => {
      const at = await api.at(hash);
      const account = (await at.query.system.account(who)) as unknown as AccountCodec;
      const existentialDeposit = (api.consts.balances as { existentialDeposit?: { toString?: () => string } }).existentialDeposit;
      return {
        free: account.data.free.toString(),
        reserved: account.data.reserved?.toString() ?? null,
        frozen: largestFrozenBalance([
          account.data.frozen?.toString(),
          account.data.miscFrozen?.toString(),
          account.data.feeFrozen?.toString(),
        ]),
        existentialDeposit: existentialDeposit?.toString?.() ?? null,
      };
    },
  });
}

type AccountCodec = {
  data: {
    free: { toString(): string };
    reserved?: { toString(): string };
    frozen?: { toString(): string };
    miscFrozen?: { toString(): string };
    feeFrozen?: { toString(): string };
  };
};

function sumDebits(fee: bigint | null, debits: Array<bigint | null>): bigint | null {
  if (fee === null || fee < BigInt(0)) return null;
  let total = fee;
  for (const debit of debits) {
    if (debit === null || debit < BigInt(0)) return null;
    total += debit;
  }
  return total;
}

function shown(amount: bigint, decimals: number, symbol: string): string {
  return `${formatUnits(amount.toString(), decimals)} ${symbol}`;
}

function refuse(detail: string): PreflightRefusal {
  return { ok: false, message: `${detail} ${GUARD} The wallet was not opened.` };
}
