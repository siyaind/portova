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

  const connect = useCallback(async () => {
    if (enableTask.current) {
      setStatus("error");
      setError("A wallet request is still open. Close it in the extension, then choose Connect again.");
      return;
    }
    setStatus("connecting");
    setError(null);
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
      if (extensions.length === 0) {
        setAccounts([]);
        setSelected(null);
        setStatus("missing");
        const injected = (window as Window & { injectedWeb3?: Record<string, unknown> }).injectedWeb3;
        const extensionInstalled = Boolean(injected && Object.keys(injected).length > 0);
        setError(
          extensionInstalled
            ? "A wallet request is still open. Close it in the extension, then choose Connect again."
            : "No wallet extension answered. Install Polkadot.js, Talisman, or SubWallet, then reload this page.",
        );
        return;
      }
      const injected = await web3Accounts();
      const next = injected.map((account) => ({
        address: account.address,
        name: account.meta.name ?? "Account",
        source: account.meta.source ?? "extension",
      }));
      setAccounts(next);
      const stored = window.sessionStorage.getItem("portova.substrate.selected");
      const chosen = next.find((account) => account.address === stored) ?? next[0] ?? null;
      setSelected(chosen);
      if (!chosen) {
        setStatus("missing");
        setError("No account was chosen. Choose Connect again.");
        return;
      }
      window.sessionStorage.setItem("portova.substrate.selected", chosen.address);
      setStatus("ready");
      window.sessionStorage.setItem("portova.substrate.connected", "1");
    } catch (cause) {
      setStatus("error");
      setError(errorText(cause));
    }
  }, []);

  const select = useCallback(
    (address: string) => {
      const match = accounts.find((account) => account.address === address);
      if (!match) return;
      setSelected(match);
      window.sessionStorage.setItem("portova.substrate.selected", match.address);
    },
    [accounts],
  );

  const disconnect = useCallback(() => {
    setAccounts([]);
    setSelected(null);
    setError(null);
    setStatus("idle");
    window.sessionStorage.removeItem("portova.substrate.connected");
    window.sessionStorage.removeItem("portova.substrate.selected");
  }, []);

  useEffect(() => {
    if (window.sessionStorage.getItem("portova.substrate.connected") !== "1") return;
    void connect();
  }, [connect]);

  const value = useMemo(
    () => ({ status, accounts, selected, error, connect, select, disconnect }),
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
