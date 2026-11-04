"use client";
import { useEffect, useRef, useState } from "react";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { signedProjectRequest } from "@/lib/project-client";
import { Button, Panel, StatusPill } from "@/components/ui";
type Access = {
  source: string;
  endsAt: string | null;
  projects: number;
  collaborators: number;
};
export function PilotAccess() {
  const wallet = useSubstrateWallet();
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [access, setAccess] = useState<Access | null>(null);
  const lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setAccess(null);
    setNotice("");
  }, [wallet.selected?.address]);
  async function request(action: "pilot" | "list") {
    if (!wallet.selected) {
      setNotice("Connect your Substrate wallet and select an account, then check or activate your access.");
      await wallet.connect();
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const signer = wallet.selected,
      version = wallet.getVersion();
    try {
      const valid = () => mounted.current && wallet.getVersion() === version;
      const result = await signedProjectRequest({ action }, signer, valid);
      if (!valid()) return;
      if (action === "list") {
        setAccess(result.access);
        setNotice("Access details refreshed.");
      } else {
        setAccess({
          source: result.pilot.active ? "pilot" : "free",
          endsAt: result.pilot.endsAt,
          projects: 5,
          collaborators: 3,
        });
        setNotice(result.message);
      }
    } catch (e) {
      if (mounted.current)
        setNotice(e instanceof Error ? e.message : "Access request failed.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const expired = !!access?.endsAt && Date.parse(access.endsAt) <= Date.now();
  return (
    <div id="pilot-access">
      <Panel className="pilot-access space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Build with the free pilot</h2>
          <StatusPill tone="muted">No payment required</StatusPill>
        </div>
        <p className="max-w-3xl text-sm leading-7 text-muted">
          Try project monitoring, indexed activity and collaboration for 30
          days. One pilot per wallet, with up to five projects and three
          collaborators per project. Checks are periodic and alerts appear in
          your workspace.
        </p>
        {access && (
          <p className="text-sm text-muted">
            {access.source === "pilot"
              ? "Pilot active"
              : expired
                ? "Pilot ended"
                : access.source === "free"
                  ? "Explorer access"
                  : "Plan access active"}
            {access.endsAt
              ? ` · ${expired ? "Ended" : "Until"} ${new Date(access.endsAt).toLocaleDateString()}`
              : ""}
            . Current project limit:{" "}
            {access.source === "pilot" ? 5 : access.projects}.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={
              busy ||
              access?.source === "pilot" ||
              expired ||
              (!!access && access.source !== "free")
            }
            onClick={() => void request("pilot")}
          >
            {busy
              ? "Waiting for wallet…"
              : access?.source === "pilot"
                ? "Pilot active"
                : expired
                  ? "Pilot already used"
                  : "Activate free pilot"}
          </Button>
          <Button disabled={busy} onClick={() => void request("list")}>
            Check my access
          </Button>
        </div>
        <p className="text-xs leading-6 text-muted">
          These actions sign a storage message and transfer no funds. Access
          expires automatically; there is no automatic renewal.
        </p>
        {notice && (
          <p role="status" className="text-sm leading-7 text-muted">
            {notice}
          </p>
        )}
      </Panel>
    </div>
  );
}
