import type { ApiPromise } from "@polkadot/api";
import type { Signer } from "@polkadot/types/types";
import { plainChainError } from "./chain-error.ts";
import { collectionIdForHash, reconcileExtrinsic } from "./tx-reconcile.ts";
import { extrinsicDispatch, outcomeAfterWait } from "./tx-result.ts";
import { feePaidFor } from "./fee-evidence.ts";

export type AssetConstants = {
  assetDeposit: string;
  assetAccountDeposit: string;
  metadataDepositBase: string;
  metadataDepositPerByte: string;
  stringLimit: number;
};

export type CreateMintParams = {
  id: number;
  admin: string;
  minBalance: bigint;
  name: string;
  symbol: string;
  decimals: number;
  beneficiary: string;
  supply: bigint;
};

export type TxPhase = "signing" | "submitted" | "included" | "finalized" | "failed" | "ambiguous";

export type TxUpdate = {
  status: TxPhase;
  hash?: string;
  error?: string;
  collectionId?: string;
  blockHash?: string;
  extrinsicIndex?: number;
  estimatedFee?: string; feeBudget?: string; actualFee?: string; feeTip?: string; preflightBlockHash?: string; runtimeVersion?: string; call?: string;
  notBroadcast?: boolean;
  account?: string; genesisHash?: string;
};

type ChainEvent = {
  phase?: {
    isApplyExtrinsic?: boolean;
    asApplyExtrinsic?: { toNumber?: () => number } | number;
    ApplyExtrinsic?: number;
  };
  event: {
    section: string;
    method: string;
    data: Array<{ toString(): string }>;
  };
};

function digits(value: { toString?: () => string } | undefined): string | null {
  const text = value?.toString?.();
  return text && /^\d+$/.test(text) ? text : null;
}

export function readAssetConstants(api: ApiPromise): AssetConstants | null {
  const consts = api.consts.assets as unknown as {
    assetDeposit?: { toString?: () => string };
    assetAccountDeposit?: { toString?: () => string };
    metadataDepositBase?: { toString?: () => string };
    metadataDepositPerByte?: { toString?: () => string };
    stringLimit?: { toNumber?: () => number };
  };
  const assetDeposit = digits(consts.assetDeposit);
  const assetAccountDeposit = digits(consts.assetAccountDeposit);
  const metadataDepositBase = digits(consts.metadataDepositBase);
  const metadataDepositPerByte = digits(consts.metadataDepositPerByte);
  const stringLimit = consts.stringLimit?.toNumber?.();
  if (
    !assetDeposit ||
    !assetAccountDeposit ||
    !metadataDepositBase ||
    !metadataDepositPerByte ||
    typeof stringLimit !== "number"
  ) {
    return null;
  }
  return {
    assetDeposit,
    assetAccountDeposit,
    metadataDepositBase,
    metadataDepositPerByte,
    stringLimit,
  };
}

export function metadataDeposit(
  constants: AssetConstants,
  name: string,
  symbol: string,
): bigint {
  const bytes = BigInt(new TextEncoder().encode(name).length + new TextEncoder().encode(symbol).length);
  return BigInt(constants.metadataDepositBase) + BigInt(constants.metadataDepositPerByte) * bytes;
}

export function buildAssetMint(api: ApiPromise, id: number, beneficiary: string, amount: bigint) {
  return api.tx.assets.mint(id, beneficiary, amount);
}

export function buildCreateMintTx(api: ApiPromise, params: CreateMintParams) {
  return api.tx.utility.batchAll([
    api.tx.assets.create(params.id, params.admin, params.minBalance),
    api.tx.assets.setMetadata(params.id, params.name, params.symbol, params.decimals),
    api.tx.assets.mint(params.id, params.beneficiary, params.supply),
  ]);
}

export function decodeDispatchError(api: ApiPromise, dispatchError: { isModule?: boolean; asModule?: unknown; toString: () => string }): string {
  if (dispatchError.isModule && dispatchError.asModule) {
    const decoded = api.registry.findMetaError(dispatchError.asModule as never);
    const docs = decoded.docs.map((doc) => doc.toString()).join(" ").trim();
    return docs
      ? `${decoded.section}.${decoded.name}: ${docs}`
      : `${decoded.section}.${decoded.name}`;
  }
  return plainChainError(dispatchError.toString());
}

export async function signAndSend(
  api: ApiPromise,
  tx: {
    signAndSend: (
      address: string,
      options: { signer: Signer },
      callback: (result: {
        txHash: { toHex(): string };
        txIndex?: number;
        dispatchError?: { isModule?: boolean; asModule?: unknown; toString(): string };
        status: {
          isInBlock: boolean;
          isFinalized: boolean;
          isBroadcast: boolean;
          isReady: boolean;
          isDropped: boolean;
          isInvalid: boolean;
          isUsurped: boolean;
          type: string;
          asInBlock?: { toHex(): string };
          asFinalized?: { toHex(): string };
        };
        events?: ChainEvent[];
      }) => void,
    ) => Promise<() => void>;
    signAsync?: (
      address: string,
      options: { signer: Signer },
    ) => Promise<{
      send: (
        callback: (result: {
          txHash: { toHex(): string };
          txIndex?: number;
          dispatchError?: { isModule?: boolean; asModule?: unknown; toString(): string };
          status: {
            isInBlock: boolean;
            isFinalized: boolean;
            isBroadcast: boolean;
            isReady: boolean;
            isDropped: boolean;
            isInvalid: boolean;
            isUsurped: boolean;
            type: string;
            asInBlock?: { toHex(): string };
            asFinalized?: { toHex(): string };
          };
          events?: ChainEvent[];
        }) => void,
      ) => Promise<() => void>;
    }>;
  },
  address: string,
  signer: Signer,
  onUpdate: (update: TxUpdate) => void,
  decorate?: (result: { events?: ChainEvent[] }) => Partial<TxUpdate>,
  revalidate?: () => Promise<boolean>,
  contextCurrent?: () => boolean,
): Promise<TxUpdate> {
  const signWaitMs = 180_000;
  const statusWaitMs = 120_000;
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    let lastHash: string | undefined;
    let sawIncluded = false;
    let broadcastStarted = false;
    let statusTimer: ReturnType<typeof setTimeout> | null = null;
    let contextTimer: ReturnType<typeof setInterval> | undefined;
    const signTimer = setTimeout(() => {
      if (!lastHash) finish({ ...outcomeAfterWait({ sawIncluded: false, chain: "unchecked" }), notBroadcast: !broadcastStarted });
    }, signWaitMs);
    const finish = (update: TxUpdate) => {
      if (settled) return;
      settled = true;
      clearTimeout(signTimer);
      clearInterval(contextTimer);
      if (statusTimer !== null) clearTimeout(statusTimer);
      unsubscribe?.();
      onUpdate(update);
      resolve(update);
    };
    const armStatusWait = (hash: string) => {
      if (statusTimer !== null) return;
      statusTimer = setTimeout(() => {
        void reconcileExtrinsic(api, hash)
          .then(async (chain) => {
            if (settled) return;
            const update = outcomeAfterWait({ hash, sawIncluded, chain });
            const collectionId =
              chain === "finalized" || chain === "included" ? await collectionIdForHash(api, hash) : null;
            finish(collectionId ? { ...update, collectionId } : update);
          })
          .catch(() => {
            if (!settled) finish(outcomeAfterWait({ hash, sawIncluded, chain: "unchecked" }));
          });
      }, statusWaitMs);
    };

    const handle = (result: {
      txHash: { toHex(): string };
      txIndex?: number;
      dispatchError?: { isModule?: boolean; asModule?: unknown; toString(): string };
      status: {
        isInBlock: boolean;
        isFinalized: boolean;
        isBroadcast: boolean;
        isReady: boolean;
        isDropped: boolean;
        isInvalid: boolean;
        isUsurped: boolean;
        type: string;
        asInBlock?: { toHex(): string };
        asFinalized?: { toHex(): string };
      };
      events?: ChainEvent[];
    }) => {
      if (settled) return;
      const hash = result.txHash.toHex();
      lastHash = hash;
      armStatusWait(hash);
      const extra = () => {
        const blockHash = result.status.isFinalized ? result.status.asFinalized?.toHex() : result.status.isInBlock ? result.status.asInBlock?.toHex() : undefined;
        const location = {
          ...feePaidFor(result.events, result.txIndex),
          ...(blockHash ? { blockHash } : {}),
          ...(result.txIndex !== undefined ? { extrinsicIndex: result.txIndex } : {}),
        };
        try {
          return { ...location, ...(decorate?.(result) ?? {}) };
        } catch {
          return location;
        }
      };
      if (result.dispatchError && (result.status.isInBlock || result.status.isFinalized)) {
        finish({
          status: "failed",
          hash,
          error: decodeDispatchError(api, result.dispatchError),
          ...extra(),
        });
        return;
      }
      if (result.status.isFinalized) {
        const verdict = extrinsicDispatch(result.events, result.txIndex);
        if (verdict === "failed") {
          finish({
            status: "failed",
            hash,
            error: result.dispatchError
              ? decodeDispatchError(api, result.dispatchError)
              : "system.ExtrinsicFailed was in the finalized block.",
            ...extra(),
          });
          return;
        }
        if (verdict !== "success") {
          finish({
            status: "ambiguous",
            hash,
            error: "The block was finalized, but system.ExtrinsicSuccess was not found for this extrinsic. It is not marked successful.",
            ...extra(),
          });
          return;
        }
        finish({ status: "finalized", hash, ...extra() });
        return;
      }
      if (result.status.isInBlock) {
        sawIncluded = true;
        onUpdate({ status: "included", hash, ...extra() });
        return;
      }
      if (result.status.isBroadcast || result.status.isReady) {
        onUpdate({ status: "submitted", hash });
        return;
      }
      if (result.status.isDropped || result.status.isInvalid || result.status.isUsurped) {
        finish({
          status: "failed",
          hash,
          error: `The node reported the transaction as ${result.status.type}.`,
        });
      }
    };
    const follow = (pending: Promise<() => void>) => {
      pending
        .then((unsub) => {
          unsubscribe = unsub;
          if (settled) unsub();
        })
        .catch((error: unknown) => {
          if (!settled) {
            settled = true;
            clearTimeout(signTimer);
            clearInterval(contextTimer);
            if (statusTimer !== null) clearTimeout(statusTimer);
            reject(error);
          }
        });
    };
    const moved = {
      status: "ambiguous" as const,
      notBroadcast: true,
      error: "The wallet, network, reviewed inputs, or chain state changed. Portova did not broadcast this request. Dismiss any old popup in your wallet, then review again.",
    };
    if (revalidate) {
      if (contextCurrent) contextTimer = setInterval(() => {
        if (!settled && !broadcastStarted && !contextCurrent()) finish(moved);
      }, 200);
      if (!tx.signAsync) {
        finish({
          status: "ambiguous",
          error: "This call cannot be signed without submitting it, so nothing was sent.",
        });
        return;
      }
      tx.signAsync(address, { signer })
        .then(async (signed) => {
          if (settled) return;
          let ok = false;
          try {
            ok = await revalidate();
          } catch {
            ok = false;
          }
          if (!ok || settled) {
            if (!settled) finish(moved);
            return;
          }
          broadcastStarted = true;
          follow(signed.send(handle));
        })
        .catch((error: unknown) => {
          if (!settled) {
            settled = true;
            clearTimeout(signTimer);
            clearInterval(contextTimer);
            if (statusTimer !== null) clearTimeout(statusTimer);
            const cause = !broadcastStarted ? Object.assign(new Error(error instanceof Error ? error.message : String(error)), { notBroadcast: true }) : error;
            reject(cause);
          }
        });
      return;
    }
    broadcastStarted = true;
    follow(tx.signAndSend(address, { signer }, handle));
  });
}

export async function assetIdTaken(api: ApiPromise, id: number): Promise<boolean> {
  const stored = await api.query.assets.asset(id);
  const optional = stored as unknown as { isNone?: boolean };
  return optional.isNone === false;
}
