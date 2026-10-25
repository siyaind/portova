"use client";

import Link from "next/link";
import type { ApiPromise } from "@polkadot/api";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useChain } from "@/components/chain/chain-provider";
import { ProceedsFigure } from "@/components/project/proceeds-figure";
import { useProject } from "@/components/project/project-provider";
import { useTxs } from "@/components/tx/tx-tracker";
import { Button, PageIntro, Panel } from "@/components/ui";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { useWalletOperation } from "@/components/wallet/use-wallet-operation";
import { errorText, formatUnits } from "@/lib/format";
import { NATIVE_DECIMALS, NATIVE_SYMBOL, TESTNET_GENESIS } from "@/lib/network";
import { reviewExtrinsic } from "@/lib/preflight";
import { guardedWallet, prepareWithdrawal, sameAccount, withdrawalStillCurrent, type WithdrawalContext, type WithdrawalRequest } from "@/lib/withdrawal";
import { outcomeWithoutHash, txResultMessage } from "@/lib/tx-result";
import { receiptExplorerUrl } from "@/lib/explorer";

const FIELD = "mt-1.5 h-11 w-full rounded-lg border border-line bg-bg px-3 font-mono text-sm";
type Review = { request: WithdrawalRequest; tx: ReturnType<ApiPromise["tx"]["balances"]["transferKeepAlive"]>; fee: bigint; spendable: bigint; createdAt: number };

export function TreasuryScreen() {
  const { ready, project } = useProject();
  const chain = useChain(), wallet = useSubstrateWallet(), txs = useTxs();
  const signer = wallet.selected;
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "reviewing" | "signing">("idle");
  const [revision, setRevision] = useState(0);
  const busy = useRef(false), alive = useRef(true);
  const context: WithdrawalContext = { account: signer?.address ?? null, source: signer?.source ?? null, proceeds: project?.proceeds ?? "", genesisHash: chain.getApi()?.genesisHash.toHex() ?? null, live: chain.status === "live" };
  const { signAndSend } = useWalletOperation({ destination, amount, proceeds: context.proceeds });
  const latest = useRef({ context, destination, amount }); latest.current = { context, destination, amount };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const draftKey = [context.account, context.source, context.proceeds, context.genesisHash, context.live, destination, amount].join("|");
  useEffect(() => { setReview(null); setMessage(null); }, [draftKey]);

  function isCurrent(request: WithdrawalRequest) {
    const now = latest.current;
    return alive.current && withdrawalStillCurrent(request, now.context, now.destination, now.amount);
  }
  async function reviewTransfer() {
    if (busy.current) return;
    setMessage(null); setHash(null);
    if (!signer) { await wallet.connect(); return; }
    const request = prepareWithdrawal(context, destination, amount, TESTNET_GENESIS);
    if (typeof request === "string") { setMessage(request); return; }
    const api = chain.getApi(); if (!api) return;
    busy.current = true; setPhase("reviewing");
    try {
      const tx = api.tx.balances.transferKeepAlive(request.destination, request.amount);
      const checked = await reviewExtrinsic(api, tx, request.sender, [request.amount]);
      if (!isCurrent(request)) return;
      if (!checked.ok) { setMessage(checked.message); return; }
      setReview({ request, tx: checked.tx, fee: checked.fee, spendable: checked.spendable, createdAt: Date.now() });
    } catch (cause) { if (alive.current) setMessage(errorText(cause)); }
    finally { busy.current = false; if (alive.current) setPhase("idle"); }
  }
  async function confirmTransfer() {
    if (busy.current || !review) return;
    const currentReview = review;
    if (!isCurrent(currentReview.request) || Date.now() - currentReview.createdAt > 60_000) { setReview(null); setMessage("This review changed or expired. Review the withdrawal again."); return; }
    const api = chain.getApi(); if (!api) return;
    busy.current = true; setPhase("signing"); setMessage(null);
    let tracked: string | null = null;
    try {
      const revalidate = async () => {
        if (!isCurrent(currentReview.request) || Date.now() - currentReview.createdAt > 60_000) return false;
        const checked = await reviewExtrinsic(api, currentReview.tx, currentReview.request.sender, [currentReview.request.amount]);
        return checked.ok && checked.fee <= currentReview.fee && isCurrent(currentReview.request) && Date.now() - currentReview.createdAt <= 60_000;
      };
      if (!(await revalidate())) { setReview(null); setMessage("The fee, balance, account, or destination changed. Review again before signing."); return; }
      const result = await guardedWallet({
        current: () => isCurrent(currentReview.request),
        open: async () => { const { web3FromSource } = await import("@polkadot/extension-dapp"); const injected = await web3FromSource(currentReview.request.source); if (!injected.signer) throw new Error("This wallet did not provide a signer."); return injected.signer; },
        submit: async (injected, current) => {
          const id = crypto.randomUUID(); tracked = id;
          txs.push({ id, label: `Withdraw ${formatUnits(currentReview.request.amount.toString(), 14)} ${NATIVE_SYMBOL}`, status: "signing", account: currentReview.request.sender });
          return signAndSend(api, currentReview.tx, currentReview.request.sender, injected, (update) => txs.patch(id, update), undefined, async () => current() && await revalidate());
        },
      });
      if (alive.current) {
        setHash(result.hash ?? null); setMessage(txResultMessage(result.status, result.error)); setReview(null);
        if (result.status === "finalized") setRevision((value) => value + 1);
      }
    } catch (cause) {
      const outcome = outcomeWithoutHash(errorText(cause));
      if (tracked) txs.patch(tracked, outcome);
      if (alive.current) { setMessage(outcome.error); setReview(null); }
    } finally { busy.current = false; if (alive.current) setPhase("idle"); }
  }
  const owns = sameAccount(signer?.address, project?.proceeds);
  const explorer = hash ? receiptExplorerUrl(hash) : null;
  return <div className="space-y-6">
    <PageIntro eyebrow="Treasury" title="Your linked account. In your control." body="Read a linked account's balance and withdraw tPOT with its wallet. This balance is not verified project revenue. Portova does not route sales, allocate royalties, or prove that funds belong to a project." />
    <Panel className="space-y-3 p-5"><h2 className="text-sm font-medium">Linked proceeds account</h2>{!ready ? <p className="text-sm text-muted">Reading your project…</p> : !project ? <p className="text-sm text-muted">Link a proceeds account in <Link href="/studio" className="text-violet">Creator Studio</Link> to get started.</p> : <><p className="text-xs text-muted">{project.name} · <Link href="/studio" className="text-violet">Edit project</Link></p><ProceedsFigure address={project.proceeds} revision={revision} /></>}</Panel>
    <div className="grid items-start gap-5 lg:grid-cols-2"><Panel className="space-y-5 p-5 sm:p-6"><h2 className="text-sm font-medium">Withdraw {NATIVE_SYMBOL}</h2><form onSubmit={(event) => { event.preventDefault(); void reviewTransfer(); }} className="space-y-4"><label className="block text-xs text-muted">Destination address<input className={FIELD} value={destination} onChange={(event) => setDestination(event.target.value)} disabled={phase === "signing"} spellCheck={false} autoComplete="off" placeholder="Prefix-42 Substrate address" /></label><label className="block text-xs text-muted">Amount ({NATIVE_SYMBOL})<input className={FIELD} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={phase === "signing"} placeholder="0.00" /></label><Button type="submit" variant="primary" disabled={!project?.proceeds || phase !== "idle" || (signer !== null && !owns) || chain.status !== "live"}>{phase === "reviewing" ? "Checking balance and fee…" : signer ? "Review withdrawal" : "Connect proceeds wallet"}</Button></form>{signer && project && !owns && <p role="alert" className="text-xs leading-6 text-warn">Connect the linked proceeds account. The current account cannot authorize its funds.</p>}<p className="flex items-start gap-2 text-xs leading-6 text-faint"><ShieldCheck size={15} className="mt-1 shrink-0 text-ok" /> The transfer keeps the sender account alive. It does not add liquidity or forward money into a pool.</p></Panel>
    <Panel className="space-y-4 p-5 sm:p-6"><h2 className="text-sm font-medium">Review before you sign</h2>{review ? <><dl className="space-y-4 text-xs"><ReviewLine title="From" value={review.request.sender} /><ReviewLine title="To" value={review.request.destination} /><ReviewLine title="Amount" value={`${formatUnits(review.request.amount.toString(), NATIVE_DECIMALS, 14)} ${NATIVE_SYMBOL}`} /><ReviewLine title="Fee budget, including safety reserve" value={`${formatUnits(review.fee.toString(), NATIVE_DECIMALS, 14)} ${NATIVE_SYMBOL}`} /><ReviewLine title="Spendable before this withdrawal" value={`${formatUnits(review.spendable.toString(), NATIVE_DECIMALS, 14)} ${NATIVE_SYMBOL}`} /><ReviewLine title="Network" value="Portaldot V3 Testnet" /></dl><p className="text-xs leading-6 text-faint">The review expires after 60 seconds. A change to the account, recipient, amount, or fee budget requires another review.</p><div className="flex flex-wrap gap-3"><Button variant="primary" disabled={phase !== "idle"} onClick={() => void confirmTransfer()}>{phase === "signing" ? "Waiting for wallet and chain…" : "Confirm in wallet"}</Button><Button disabled={phase !== "idle"} onClick={() => setReview(null)}>Cancel review</Button></div></> : <p className="text-sm leading-7 text-muted">Enter a destination and amount, then review the withdrawal. The wallet opens only after you confirm the reviewed details.</p>}{message && <p role="status" className="text-xs leading-6 text-warn">{message}</p>}{hash && <p className="font-mono text-xs break-all text-muted">{hash}</p>}{explorer && <a href={explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-violet">Inspect receipt <ArrowUpRight size={13} /></a>}<Link href="/activity" className="inline-flex text-xs text-violet">Saved receipts & recovery</Link></Panel></div>
  </div>;
}
function ReviewLine({ title, value }: { title: string; value: string }) { return <div><dt className="text-faint">{title}</dt><dd className="mt-1.5 font-mono break-all text-ink">{value}</dd></div>; }
