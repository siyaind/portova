"use client";

import { Suspense } from "react";
import { MarketScreen } from "@/components/market/market-screen";

export default function MarketPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Reading the marketplace…</p>}>
      <MarketScreen />
    </Suspense>
  );
}
