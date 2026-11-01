import Link from "next/link";
import { Panel, StatusPill } from "@/components/ui";
export default function BridgePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="product-heading">
        <div>
          <p className="product-eyebrow">External resource</p>
          <h1>Explore Portaldot’s bridge.</h1>
          <p>
            Bridging takes place on a separate service operated outside Portova.
          </p>
        </div>
      </section>
      <Panel className="space-y-5 p-6 sm:p-8">
        <StatusPill tone="warn">
          External service · verify the network
        </StatusPill>
        <h2 className="text-2xl font-semibold">Portaldot and BSC</h2>
        <p className="text-sm leading-7 text-muted">
          The Portaldot bridge interface displays a POT route from Portaldot to
          BSC. Portova currently operates on V3 Testnet with tPOT. Support for
          this testnet, user-created native assets and NFTs has not been
          verified.
        </p>
        <p className="text-sm leading-7 text-muted">
          Confirm the network, token identity, receiving address, fees and
          service terms on the bridge before connecting a wallet. Portova has
          not independently verified its settlement or security model. A
          transfer of POT is separate from a swap into USDC.
        </p>
        <a
          className="product-primary"
          href="https://bridge.portaldot.dev/en"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open external Portaldot bridge ↗
        </a>
        <p className="text-xs leading-6 text-muted">
          Opens bridge.portaldot.dev in a new tab. Portova does not initiate a
          transfer or switch your wallet network.
        </p>
      </Panel>
      <Panel className="space-y-3 p-6">
        <h2 className="text-lg font-semibold">Looking for testnet funds?</h2>
        <p className="text-sm leading-7 text-muted">
          Use Portaldot’s current test-token distribution process. A bridge is
          not a faucet, and a token labelled USD on testnet is not evidence of
          dollar backing.
        </p>
        <Link href="/settings" className="text-sm text-violet">
          View network information ↗
        </Link>
      </Panel>
    </div>
  );
}
