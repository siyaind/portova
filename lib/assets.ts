import type { ApiPromise } from "@polkadot/api";
import type { Signer } from "@polkadot/types/types";

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

export type TxPhase = "signing" | "submitted" | "included" | "finalized" | "failed";

export type TxUpdate = {
  status: TxPhase;
  hash?: string;
  error?: string;
  collectionId?: string;
};

type ChainEvent = {
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
  return dispatchError.toString();
}

export async function signAndSend(
  api: ApiPromise,
  tx: {
    signAndSend: (
      address: string,
      options: { signer: Signer },
      callback: (result: {
        txHash: { toHex(): string };
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
        };
        events?: ChainEvent[];
      }) => void,
    ) => Promise<() => void>;
  },
  address: string,
  signer: Signer,
  onUpdate: (update: TxUpdate) => void,
  decorate?: (result: { events?: ChainEvent[] }) => Partial<TxUpdate>,
): Promise<TxUpdate> {
  const signWaitMs = 180_000;
  const statusWaitMs = 120_000;
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    let lastHash: string | undefined;
    let sawIncluded = false;
    let statusTimer: ReturnType<typeof setTimeout> | null = null;
    const signTimer = setTimeout(() => {
      if (!lastHash) {
        finish({
          status: "failed",
          error: "No transaction hash arrived before the wait ended.",
        });
      }
    }, signWaitMs);
    const finish = (update: TxUpdate) => {
      if (settled) return;
      settled = true;
      clearTimeout(signTimer);
      if (statusTimer !== null) clearTimeout(statusTimer);
      unsubscribe?.();
      onUpdate(update);
      resolve(update);
    };
    const armStatusWait = (hash: string) => {
      if (statusTimer !== null) return;
      statusTimer = setTimeout(() => {
        finish(
          sawIncluded
            ? {
                status: "included",
                hash,
                error: "Included. Finalization was not reported before the wait ended.",
              }
            : {
                status: "submitted",
                hash,
                error: "The node has not reported inclusion. The hash is not a final result.",
              },
        );
      }, statusWaitMs);
    };

    tx.signAndSend(address, { signer }, (result) => {
      const hash = result.txHash.toHex();
      lastHash = hash;
      armStatusWait(hash);
      const extra = () => {
        try {
          return decorate?.(result) ?? {};
        } catch {
          return {};
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
    })
      .then((unsub) => {
        unsubscribe = unsub;
        if (settled) unsub();
      })
      .catch((error: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(signTimer);
          if (statusTimer !== null) clearTimeout(statusTimer);
          reject(error);
        }
      });
  });
}

export async function assetIdTaken(api: ApiPromise, id: number): Promise<boolean> {
  const stored = await api.query.assets.asset(id);
  const optional = stored as unknown as { isNone?: boolean };
  return optional.isNone === false;
}
