"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { errorText } from "@/lib/format";

export type SubstrateAccount = {
  address: string;
  name: string;
  source: string;
};

type SubstrateValue = {
  status: "idle" | "connecting" | "ready" | "missing" | "error";
  accounts: SubstrateAccount[];
  selected: SubstrateAccount | null;
  error: string | null;
  connect: () => Promise<void>;
  select: (address: string) => void;
  disconnect: () => void;
  getVersion: () => number;
};

const SubstrateContext = createContext<SubstrateValue | null>(null);

export function SubstrateWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<SubstrateValue["status"]>("idle");
  const [accounts, setAccounts] = useState<SubstrateAccount[]>([]);
  const [selected, setSelected] = useState<SubstrateAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enableTask = useRef<Promise<unknown> | null>(null);
  const generation = useRef(0);
  const selectedRef = useRef(selected); selectedRef.current = selected;

  const connect = useCallback(async () => {
    if (enableTask.current) {
      setStatus("error");
      setError("A wallet request is still open. Close it in the extension, then choose Connect again.");
      return;
    }
    setStatus("connecting");
    setError(null);
    const ticket = ++generation.current;
    try {
      const { web3Enable, web3Accounts } = await import(
        "@polkadot/extension-dapp"
      );
      const enabled = web3Enable("PORTOVA");
      let timer = 0;
      const tracked = enabled.finally(() => {
        enableTask.current = null;
        window.clearTimeout(timer);
      });
      void tracked.catch(() => undefined);
      enableTask.current = tracked;
      const extensions = await Promise.race([
        tracked,
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => {
            reject(
              new Error(
                "The connection request was closed. Choose Connect again. If a wallet prompt is still open, close it before trying again.",
              ),
            );
          }, 8000);
        }),
      ]);
      if (ticket !== generation.current) return;
      if (extensions.length === 0) {
        setAccounts([]);
        setSelected(null);
        setStatus("missing");
        const injected = (window as Window & { injectedWeb3?: Record<string, unknown> }).injectedWeb3;
        const extensionInstalled = Boolean(injected && Object.keys(injected).length > 0);
        setError(
          extensionInstalled
            ? "No wallet granted access. Approve account access in your extension, then choose Connect again."
            : "No wallet extension answered. Install Polkadot.js, Talisman, or SubWallet, then reload this page.",
        );
        return;
      }
      const injected = await web3Accounts();
      if (ticket !== generation.current) return;
      const next = injected.map((account) => ({
        address: account.address,
        name: account.meta.name ?? "Account",
        source: account.meta.source ?? "extension",
      }));
      setAccounts(next);
      let stored: string | null = null;
      try { stored = window.sessionStorage.getItem("portova.substrate.selected"); } catch { /* Connection still works without browser persistence. */ }
      const chosen = next.find((account) => account.address === stored) ?? next[0] ?? null;
      setSelected(chosen);
      if (!chosen) {
        setStatus("missing");
        setError("No account was chosen. Choose Connect again.");
        return;
      }
      try { window.sessionStorage.setItem("portova.substrate.selected", chosen.address); } catch { /* Optional persistence. */ }
      setStatus("ready");
      setError(null);
      try { window.sessionStorage.setItem("portova.substrate.connected", "1"); } catch { /* Optional persistence. */ }
    } catch (cause) {
      if (ticket !== generation.current) return;
      setStatus("error");
      setError(errorText(cause));
    }
  }, []);

  const select = useCallback(
    (address: string) => {
      const match = accounts.find((account) => account.address === address);
      if (!match) return;
      setSelected(match);
      generation.current += 1;
      try { window.sessionStorage.setItem("portova.substrate.selected", match.address); } catch { /* Optional persistence. */ }
    },
    [accounts],
  );

  const disconnect = useCallback(() => {
    generation.current += 1;
    setAccounts([]);
    setSelected(null);
    setError(null);
    setStatus("idle");
    try {
      window.sessionStorage.removeItem("portova.substrate.connected");
      window.sessionStorage.removeItem("portova.substrate.selected");
    } catch { /* Disconnect still applies in memory. */ }
  }, []);

  useEffect(() => {
    try { if (window.sessionStorage.getItem("portova.substrate.connected") !== "1") return; } catch { return; }
    void connect();
  }, [connect]);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void import("@polkadot/extension-dapp").then(async ({ web3AccountsSubscribe }) => {
      const stop = await web3AccountsSubscribe((injected) => {
        if (cancelled) return;
        const next = injected.map((account) => ({ address: account.address, name: account.meta.name ?? "Account", source: account.meta.source ?? "extension" }));
        setAccounts(next);
        const previous = selectedRef.current;
        const stillAllowed = next.find((account) => account.address === previous?.address && account.source === previous.source) ?? null;
        if (previous?.address !== stillAllowed?.address || previous?.source !== stillAllowed?.source) generation.current += 1;
        setSelected(stillAllowed);
        if (previous && !stillAllowed) setError("The selected account is no longer shared by the wallet. Select an authorized account before signing.");
      });
      if (cancelled) stop(); else unsubscribe = stop;
    }).catch(() => { if (!cancelled) setError("Wallet account updates are unavailable. Reconnect before signing if permissions change."); });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [status]);

  const value = useMemo(
    () => ({ status, accounts, selected, error, connect, select, disconnect, getVersion: () => generation.current }),
    [status, accounts, selected, error, connect, select, disconnect],
  );

  return (
    <SubstrateContext.Provider value={value}>
      {children}
    </SubstrateContext.Provider>
  );
}

export function useSubstrateWallet(): SubstrateValue {
  const value = useContext(SubstrateContext);
  if (!value) {
    throw new Error("useSubstrateWallet must be used inside SubstrateWalletProvider");
  }
  return value;
}
