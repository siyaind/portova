"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useConnection, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { Button } from "@/components/ui";
import { CHAIN_ID, NATIVE_DECIMALS, NATIVE_SYMBOL } from "@/lib/network";
import { shortAddress } from "@/lib/format";

export function WalletDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const substrate = useSubstrateWallet();
  const connection = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const wrongChain =
    connection.isConnected && connection.chainId !== CHAIN_ID;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto p-3">
      <button
        type="button"
        aria-label="Dismiss wallet dialog"
        className="fixed inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="wallet-dialog-surface relative mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-panel"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              Wallets
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              The Substrate wallet signs asset creation, NFT minting, liquidity,
              and NFT sales when the runtime trading feature is on. EVM actions
              are still not submitted from this build.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-panel-2 hover:text-ink"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">

        <section>
          <h3 className="text-sm font-medium">Substrate wallet</h3>
          <p className="mt-1 text-xs leading-5 text-faint">
            Polkadot.js, Talisman, or SubWallet. Balances for the selected
            account are read from System.Account.
          </p>
          {substrate.accounts.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {substrate.accounts.map((account) => {
                const active = substrate.selected?.address === account.address;
                return (
                  <li key={account.address}>
                    <button
                      type="button"
                      onClick={() => {
                        substrate.select(account.address);
                        onClose();
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-left ${
                        active ? "border-violet bg-panel-2" : "border-line hover:bg-panel-2"
                      }`}
                    >
                      <span className="block text-sm">{account.name}</span>
                      <span className="mt-0.5 block font-mono text-xs text-muted">
                        {shortAddress(account.address, 8, 6)}
                      </span>
                      <span className="mt-1 block text-xs text-faint">
                        {account.source}
                        {active ? " · selected" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {substrate.error ? (
            <p className="mt-3 text-sm leading-6 text-warn">{substrate.error}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={substrate.status === "connecting"}
              onClick={() => void substrate.connect()}
            >
              {substrate.status === "connecting"
                ? "Looking for extension…"
                : substrate.accounts.length > 0
                  ? "Refresh accounts"
                  : "Connect Substrate wallet"}
            </Button>
            {substrate.accounts.length > 0 ? (
              <Button onClick={substrate.disconnect}>Disconnect</Button>
            ) : null}
          </div>
        </section>

        <section className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-medium">EVM wallet</h3>
          <p className="mt-1 text-xs leading-5 text-faint">
            Injected wallet on chain id {CHAIN_ID}. {NATIVE_SYMBOL} on Substrate
            has {NATIVE_DECIMALS} decimals. This app does not display the EVM
            native balance as {NATIVE_SYMBOL}, because the Revive scaling ratio
            is unproven.
          </p>
          {connection.address ? (
            <p className="mt-3 font-mono text-sm">
              {shortAddress(connection.address, 8, 6)}
              <span className="mt-1 block font-sans text-xs text-faint">
                Chain {connection.chainId ?? "unknown"}
                {wrongChain ? " · wrong network" : " · Portaldot V3 Testnet"}
              </span>
            </p>
          ) : null}
          {wrongChain ? (
            <p className="mt-3 text-sm leading-6 text-warn">
              Switch the wallet to Portaldot V3 Testnet ({CHAIN_ID}) before a
              later Revive action. No transaction is sent by that switch.
            </p>
          ) : null}
          {connect.error ? (
            <p className="mt-3 text-sm leading-6 text-warn">{connect.error.message}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {connection.isConnected ? (
              <>
                {wrongChain ? (
                  <Button
                    variant="primary"
                    disabled={switchChain.isPending}
                    onClick={() => switchChain.mutate({ chainId: CHAIN_ID })}
                  >
                    {switchChain.isPending ? "Requesting switch…" : "Switch network"}
                  </Button>
                ) : null}
                <Button
                  disabled={disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                >
                  Disconnect EVM
                </Button>
              </>
            ) : (
              connect.connectors.map((connector) => (
                <Button
                  key={connector.uid}
                  variant="primary"
                  disabled={connect.isPending}
                  onClick={() =>
                    connect.mutate({ connector, chainId: CHAIN_ID })
                  }
                >
                  {connect.isPending ? "Waiting for wallet…" : connector.name}
                </Button>
              ))
            )}
          </div>
        </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
