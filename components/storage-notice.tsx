"use client";
import { useEffect, useState } from "react";
export function StorageNotice() {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    try { const key = `portova.storage-check.${crypto.randomUUID()}`; window.localStorage.setItem(key, "1"); window.localStorage.removeItem(key); }
    catch { setUnavailable(true); }
  }, []);
  return unavailable ? <p role="alert" className="border-b border-warn/30 bg-panel px-5 py-3 text-sm text-warn">Browser storage is blocked. Chain browsing remains available. Local projects and staged NFT launches cannot be saved; export any in-memory receipts before closing.</p> : null;
}
