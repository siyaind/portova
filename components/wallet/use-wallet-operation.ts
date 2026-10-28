"use client";

import { useEffect, useRef } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import type { signAndSend as submit } from "@/lib/assets";
import { guardedSignAndSend, operationDraft, walletOperation, type WalletOperationContext } from "@/lib/wallet-operation";
import { sameAccount } from "@/lib/withdrawal";

export function useWalletOperation(draft: unknown) {
  const chain = useChain(), wallet = useSubstrateWallet(), api = chain.getApi();
  const alive = useRef(true);
  const last = useRef<{ key: string; api: typeof api; revision: number }>({ key: "", api, revision: 0 });
  const context = {
    account: wallet.selected?.address ?? null, source: wallet.selected?.source ?? null,
    genesisHash: api?.genesisHash.toHex() ?? null,
    runtime: api ? `${api.runtimeVersion.specName}:${api.runtimeVersion.specVersion}` : null,
    live: chain.status === "live", draft: operationDraft(draft),
  };
  const key = operationDraft(context);
  if (last.current.key !== key || last.current.api !== api) last.current = { key, api, revision: last.current.revision + 1 };
  const current = useRef<WalletOperationContext>({ ...context, revision: last.current.revision });
  current.current = { ...context, revision: last.current.revision };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const expectedApi = api, expectedAccount = context.account;
  const walletVersion = wallet.getVersion();
  const guard = walletOperation(current.current, () => {
    const connectedApi = chain.getApi();
    return { ...current.current, live: alive.current && current.current.live && connectedApi === expectedApi && connectedApi?.isConnected === true && navigator.onLine,
      genesisHash: connectedApi?.genesisHash.toHex() ?? null,
      runtime: connectedApi ? `${connectedApi.runtimeVersion.specName}:${connectedApi.runtimeVersion.specVersion}` : null,
      revision: wallet.getVersion() === walletVersion ? last.current.revision : -1 };
  });
  async function signAndSend(...args: Parameters<typeof submit>) {
    guard.assertCurrent();
    if (args[0] !== expectedApi || !sameAccount(args[2], expectedAccount)) throw new Error("The reviewed call belongs to a different wallet or connection. Nothing was submitted.");
    return guardedSignAndSend(guard, args);
  }
  return { signAndSend, current: guard.current };
}
