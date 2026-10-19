"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const { web3Enable, web3Accounts } = await import(
        "@polkadot/extension-dapp"
      );
      const enabled = web3Enable("PORTOVA");
      let timer = 0;
      const extensions = await Promise.race([
        enabled.finally(() => window.clearTimeout(timer)),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => {
            reject(
              new Error(
                "No Substrate wallet responded. Install Polkadot.js, Talisman, or SubWallet, then reload this page.",
              ),
            );
          }, 8000);
        }),
      ]);
      if (extensions.length === 0) {
        setAccounts([]);
        setSelected(null);
        setStatus("missing");
        setError(
          "No Substrate wallet extension was found. Install Polkadot.js, Talisman, or SubWallet, then reload this page.",
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
      setSelected(next[0] ?? null);
      if (next.length === 0) {
        setStatus("missing");
        setError("The wallet extension is installed and has no accounts.");
        return;
      }
      setStatus("ready");
    } catch (cause) {
      setStatus("error");
      setError(errorText(cause));
    }
  }, []);

  const select = useCallback(
    (address: string) => {
      const match = accounts.find((account) => account.address === address);
      if (match) setSelected(match);
    },
    [accounts],
  );

  const disconnect = useCallback(() => {
    setAccounts([]);
    setSelected(null);
    setError(null);
    setStatus("idle");
  }, []);

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
