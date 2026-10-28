"use client";

import { LpHoldings } from "@/components/lp-holdings";
import { HoldingsTable } from "@/components/holdings";
import { ModuleScreen } from "@/components/module-screen";
import { Panel } from "@/components/ui";

export default function PortfolioPage() {
  return (
    <ModuleScreen
      eyebrow="Portfolio"
      title="Holdings for the connected account"
      body="Native tPOT is the free balance from System.Account. Created-asset rows appear only when Assets.account returns a positive balance. NFT item ownership is not scanned."
    >
      <Panel>
        <HoldingsTable />
      </Panel>
      <LpHoldings />
    </ModuleScreen>
  );
}
