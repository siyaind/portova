import Link from "next/link";
import { Panel } from "@/components/ui";
const tools = [
  [
    "/studio",
    "Project details",
    "Edit linked objects and inspect project health.",
  ],
  [
    "/token-launchpad",
    "Native token tools",
    "Create and manage native fungible assets.",
  ],
  [
    "/nft-launchpad",
    "Collection tools",
    "Create a collection and manage minting.",
  ],
  [
    "/market",
    "NFT gallery & trading status",
    "Inspect listings and runtime trading availability.",
  ],
  [
    "/treasury",
    "Account transfers",
    "Review native balance transfers from your wallet.",
  ],
  [
    "/activity",
    "Transaction receipts",
    "Inspect this browser’s transaction history and export receipts.",
  ],
  [
    "/run",
    "Testnet rehearsal",
    "A technical checklist for testing supported native operations.",
  ],
  [
    "/overview",
    "Account overview",
    "View network totals and your connected account holdings.",
  ],
];
export default function ToolsPage() {
  return (
    <div className="space-y-7">
      <section className="product-heading">
        <div>
          <p className="product-eyebrow">Developer tools</p>
          <h1>A closer look, when you need it.</h1>
          <p>Advanced controls and testing tools for Portaldot V3 Testnet.</p>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map(([href, title, body]) => (
          <Panel key={href} className="p-6">
            <h2 className="mb-3 text-lg font-semibold">
              <Link className="hover:text-violet" href={href}>
                {title} ↗
              </Link>
            </h2>
            <p className="text-sm leading-7 text-muted">{body}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
