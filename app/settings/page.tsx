"use client";

import type { ReactNode } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { ModuleScreen } from "@/components/module-screen";
import { Panel, StatusPill } from "@/components/ui";
import {
  CHAIN_ID,
  EVM_HTTP,
  NATIVE_DECIMALS,
  NATIVE_SYMBOL,
  NODE_CONSOLE,
  SUBSTRATE_WS,
} from "@/lib/network";

export default function SettingsPage() {
  const chain = useChain();

  return (
    <ModuleScreen
      eyebrow="Settings"
      title="Network and balance rules"
      body="This build has one network. Mainnet is not configured. Endpoint values are public testnet URLs, not secrets."
    >
      <Panel className="divide-y divide-line">
        <Setting
          label="Network"
          value={
            chain.status === "live"
              ? `${chain.chainName ?? "Portaldot V3 Test"} · chain id ${CHAIN_ID}`
              : `Portaldot V3 Testnet · chain id ${CHAIN_ID}`
          }
          extra={
            chain.status === "live" ? (
              <StatusPill tone="ok">
                {chain.blockNumber ? `Block ${chain.blockNumber}` : "Live"}
              </StatusPill>
            ) : chain.status === "connecting" ? (
              <StatusPill tone="warn">Connecting</StatusPill>
            ) : (
              <StatusPill tone="bad">Unavailable</StatusPill>
            )
          }
        />
        <Setting label="Substrate RPC" value={SUBSTRATE_WS} />
        <Setting label="EVM RPC" value={EVM_HTTP} />
        <Setting label="Node console" value={NODE_CONSOLE} />
        <Setting
          label="Native token"
          value={`${NATIVE_SYMBOL}, ${NATIVE_DECIMALS} decimals, read from System.Account`}
        />
        <Setting
          label="EVM display"
          value="The wallet chain record uses 18 decimals because EVM tooling expects wei. PORTOVA does not convert that figure into tPOT. The Revive native-to-ETH ratio was not stored under NativeToEthRatio."
        />
        <Setting
          label="Deployment"
          value="Local only. No contract, indexer, custom AMM, or mainnet endpoint is configured."
        />
        <Setting
          label="Trust"
          value="The testnet has a sudo key and a development node build. Do not send assets you cannot afford to lose."
        />
      </Panel>
      {chain.error ? (
        <p className="text-sm leading-6 text-warn">{chain.error}</p>
      ) : null}
    </ModuleScreen>
  );
}

function Setting({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 font-mono text-xs leading-5 break-all text-muted">{value}</p>
      </div>
      {extra}
    </div>
  );
}
