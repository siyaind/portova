"use client";

import { useParams } from "next/navigation";
import { TokenProfile } from "@/components/token/token-profile";

export default function TokenPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <TokenProfile id={id ?? ""} />;
}
