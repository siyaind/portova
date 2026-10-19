"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { CollectionProfile } from "@/components/nft/collection-profile";

export default function CollectionPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return (
    <Suspense fallback={<p className="text-sm text-muted">Reading collection…</p>}>
      <CollectionProfile id={id ?? ""} />
    </Suspense>
  );
}
