import { SwapScreen } from "@/components/swap/swap-screen";

export default async function SwapPage({ searchParams }: {
  searchParams: Promise<{ pool?: string | string[] }>;
}) {
  const raw = (await searchParams).pool;
  const requestedPool = typeof raw === "string" && /^\d+$/.test(raw) ? raw : null;
  return <SwapScreen key={requestedPool ?? "default"} requestedPool={requestedPool} />;
}
