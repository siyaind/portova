"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { ChainProvider } from "@/components/chain/chain-provider";
import { ProjectProvider } from "@/components/project/project-provider";
import { TxProvider } from "@/components/tx/tx-tracker";
import { SubstrateWalletProvider } from "@/components/wallet/substrate-wallet";
import { wagmiConfig } from "@/lib/wagmi";
import { StorageNotice } from "@/components/storage-notice";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <ChainProvider>
          <SubstrateWalletProvider>
            <TxProvider>
              <ProjectProvider><StorageNotice />{children}</ProjectProvider>
            </TxProvider>
          </SubstrateWalletProvider>
        </ChainProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
