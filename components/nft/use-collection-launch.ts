"use client";
import { useEffect, useRef, useState } from "react";
import { useChain } from "@/components/chain/chain-provider";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { useTxs } from "@/components/tx/tx-tracker";
import { launchStage, parsePendingLaunch, pendingStorageKey, updateLaunch, type PendingCollectionLaunch, type PendingLaunchSettings } from "@/lib/pending-collection";
import { reconcileReceipt } from "@/lib/tx-reconcile";
import { readCollectionProfile } from "@/lib/nfts";
import { readItemProfile } from "@/lib/nfts";
import { byteLength } from "@/lib/format";
import { readNftConstants } from "@/lib/nfts";
import { isProceedsAddress } from "@/lib/project";
import { sameAccount } from "@/lib/withdrawal";
import type { TxUpdate } from "@/lib/assets";
import type { ApiPromise } from "@polkadot/api";
import { acquireLease, type Lease } from "@/lib/browser-lock";

/** One durable, account-bound launch shared by /run and /nft-launchpad. */
export function useCollectionLaunch() {
  const chain = useChain(), wallet = useSubstrateWallet(), txs = useTxs();
  const api = chain.getApi(), payer = wallet.selected?.address;
  const key = api && payer ? pendingStorageKey(api.genesisHash.toHex(), payer) : null;
  const records = useRef(new Map<string, PendingCollectionLaunch | null>());
  const invalid = useRef(new Set<string>());
  const currentKey = useRef(key); currentKey.current = key;
  const [loaded, setLoaded] = useState<string | null>(null), [, rerender] = useState(0);
  const [error, setError] = useState<string | null>(null), [checking, setChecking] = useState(false);
  const mounted = useRef(true);
  const held = useRef<{ key: string; lease: Lease } | null>(null);
  const recoveries = useRef(new Set<Lease>());
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; void held.current?.lease.release(); held.current = null; for (const lease of recoveries.current) void lease.release(); recoveries.current.clear(); }; }, []);
  useEffect(() => () => { for (const lease of recoveries.current) void lease.release(); recoveries.current.clear(); }, [key]);
  const launch = key && loaded === key ? records.current.get(key) ?? null : null;
  function checkpointCurrent(storageKey = key) {
    try { return !!storageKey && held.current?.key === storageKey && JSON.stringify(parsePendingLaunch(window.localStorage.getItem(storageKey))) === JSON.stringify(records.current.get(storageKey) ?? null); }
    catch { return false; }
  }
  async function acquire() {
    if (!key || held.current) throw Error("A launch operation is already active. Wait for its result.");
    const expected = JSON.stringify(records.current.get(key) ?? null);
    const lease = await acquireLease(`portova:nft:${key}`, navigator.locks);
    try {
      const raw = window.localStorage.getItem(key), latest = parsePendingLaunch(raw);
      if ((raw && !latest) || key !== currentKey.current || expected !== JSON.stringify(latest)) throw Error("The saved launch changed in another tab. Review its updated checkpoint before signing.");
      held.current = { key, lease };
      return () => { if (held.current?.lease === lease) held.current = null; lease.release(); };
    } catch (cause) { lease.release(); throw cause; }
  }
  function save(record: PendingCollectionLaunch | null, mustPersist = false, storageKey = key) {
    if (!storageKey) throw Error("Connect the launch wallet first.");
    try {
      if (record) window.localStorage.setItem(storageKey, JSON.stringify(record)); else window.localStorage.removeItem(storageKey);
    } catch {
      const message = "The launch checkpoint could not be saved. Enable browser storage before starting a collection.";
      if (mounted.current && currentKey.current === storageKey) setError(message);
      if (mustPersist) throw Error(message);
    }
    try { window.sessionStorage.removeItem(storageKey); } catch { /* Legacy session storage is optional once local persistence succeeds. */ }
    records.current.set(storageKey, record);
    if (mounted.current && currentKey.current === storageKey) rerender(value => value + 1);
    window.dispatchEvent(new CustomEvent("portova:launch-checkpoint", { detail: storageKey }));
  }
  async function recover(record = launch, storageKey = key) {
    if (!api || !payer || !record || !storageKey || checking) return;
    setChecking(true); setError(null);
    let recoveryLease: Lease | null = null;
    try {
      recoveryLease = await acquireLease(`portova:nft:${storageKey}`, navigator.locks);
      if (!mounted.current || currentKey.current !== storageKey) return;
      recoveries.current.add(recoveryLease);
      const latest = parsePendingLaunch(window.localStorage.getItem(storageKey));
      if (JSON.stringify(latest) !== JSON.stringify(record)) throw Error("The launch changed in another tab. Check the updated checkpoint.");
      let next = record;
      if (record.createHash && record.createStatus !== "finalized") {
        const receipt = txs.items.find(item => item.hash === record.createHash);
        const result = await reconcileReceipt(api, record.createHash, { blockHash: record.createBlockHash ?? receipt?.blockHash, blockNumber: receipt?.blockNumber, cursor: record.searchCursor, maxBlocks: 64 });
        if (result.chain === "finalized" || result.chain === "failed") next = updateLaunch(next, "create", { status: result.chain, hash: record.createHash, collectionId: result.collectionId, blockHash: result.blockHash });
        else { next = { ...next, searchCursor: result.nextCursor }; setError(result.error ?? "Create outcome is not yet verified. Continue recovery or inspect the receipt before starting another collection."); }
      }
      if (next.collectionId) {
        const at = await api.at(await api.rpc.chain.getFinalizedHead());
        const profile = await readCollectionProfile(at as unknown as ApiPromise, next.collectionId);
        if (!profile.found || !sameAccount(profile.owner, next.payer)) throw Error("The saved collection is not owned by the launch account. It cannot be resumed here.");
        if (next.createStatus !== "failed" && next.createStatus !== "finalized") {
          next = { ...next, createStatus: "finalized" };
          setError("The saved collection and its owner were verified in finalized state. Its original create receipt is still available for separate inspection.");
        }
      }
      if (next.finishHash && next.finishStatus !== "finalized" && next.finishStatus !== "failed") {
        const receipt = txs.items.find(item => item.hash === next.finishHash);
        const result = await reconcileReceipt(api, next.finishHash, { blockHash: next.finishBlockHash ?? receipt?.blockHash, blockNumber: receipt?.blockNumber, cursor: next.finishSearchCursor, maxBlocks: 64 });
        if (result.chain === "finalized" || result.chain === "failed") next = updateLaunch(next, "finish", { status: result.chain, hash: next.finishHash, blockHash: result.blockHash });
        else { next = { ...next, finishSearchCursor: result.nextCursor }; setError("The second signature's outcome is unknown. Continue recovery or inspect its receipt before retrying."); }
      }
      if (mounted.current && currentKey.current === storageKey && recoveries.current.has(recoveryLease) && records.current.get(storageKey) === record) save(next, false, storageKey);
    } catch (cause) { if (mounted.current && currentKey.current === storageKey) setError(cause instanceof Error ? cause.message : "Launch recovery failed."); }
    finally { if (recoveryLease) { recoveries.current.delete(recoveryLease); void recoveryLease.release(); } if (mounted.current && currentKey.current === storageKey) setChecking(false); }
  }
  useEffect(() => {
    if (!key || !api || chain.status !== "live") return;
    setError(null); setChecking(false);
    try {
      let raw = window.localStorage.getItem(key), legacy = false;
      if (!raw) { try { raw = window.sessionStorage.getItem(key); legacy = !!raw; } catch { /* No legacy session checkpoint is available. */ } }
      const record = parsePendingLaunch(raw);
      records.current.set(key, record); setLoaded(key);
      if (raw && !record) { invalid.current.add(key); setError("The saved launch checkpoint is invalid. Inspect Activity before clearing it; creation is paused to avoid duplicating a collection."); return; }
      invalid.current.delete(key);
      if (record && !legacy) void recover(record, key);
      else if (record) void (async () => {
        const lease = await acquireLease(`portova:nft:${key}`, navigator.locks);
        try { if (window.localStorage.getItem(key)) throw Error("Another tab already migrated this launch. Review its checkpoint."); save(record, true, key); }
        finally { await lease.release(); }
        await recover(record, key);
      })().catch(cause => setError(cause instanceof Error ? cause.message : "Launch migration failed."));
    } catch { invalid.current.add(key); setError("The saved launch could not be read. Browser storage is required for staged creation."); setLoaded(key); }
    // Recovery is intentionally triggered per wallet/network, not on every head or receipt update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, chain.status]);
  useEffect(() => {
    if (!key) return;
    function synchronize(event: Event) {
      if (event instanceof StorageEvent && event.key !== key) return;
      if (event instanceof CustomEvent && event.detail !== key) return;
      try {
        const raw = window.localStorage.getItem(key!), next = parsePendingLaunch(raw);
        if (raw && !next) { invalid.current.add(key!); setError("The checkpoint in another tab is invalid. Inspect Activity before clearing it."); }
        else invalid.current.delete(key!);
        if (JSON.stringify(next) !== JSON.stringify(records.current.get(key!) ?? null)) {
          records.current.set(key!, next); setLoaded(key); rerender(value => value + 1);
          setError("The launch checkpoint was updated in another tab or screen. Review the current stage before signing.");
        }
      } catch { invalid.current.add(key!); setError("Checkpoint storage is unavailable. Signing is paused."); }
    }
    window.addEventListener("storage", synchronize); window.addEventListener("portova:launch-checkpoint", synchronize);
    return () => { window.removeEventListener("storage", synchronize); window.removeEventListener("portova:launch-checkpoint", synchronize); };
  }, [key]);
  function begin(settings: PendingLaunchSettings) {
    if (!api || !payer || !key || loaded !== key || invalid.current.has(key)) throw Error("Wait for a valid launch checkpoint before signing.");
    if (records.current.get(key)) throw Error("Resolve or explicitly leave the existing launch before creating another collection.");
    if (!checkpointCurrent()) throw Error("Acquire the launch lock and review the current checkpoint before signing.");
    const record: PendingCollectionLaunch = { genesisHash: api.genesisHash.toHex(), payer, collectionId: null, createHash: null, createStatus: "signing", settings };
    save(record, true); return record;
  }
  function update(step: "create" | "finish", update: TxUpdate) {
    if (!key) return;
    const record = records.current.get(key); if (record) save(updateLaunch(record, step, update));
  }
  async function assertCanFinish() {
    if (!checkpointCurrent()) throw Error("The launch checkpoint changed or is being used elsewhere. Nothing was submitted.");
    if (!api || !payer || !launch || launchStage(launch) !== "ready-to-finish" || !sameAccount(payer, launch.payer) || launch.genesisHash !== api.genesisHash.toHex()) throw Error("Recover the finalized create receipt with its original wallet before finishing.");
    const constants = readNftConstants(api);
    if (!constants || byteLength(launch.settings.collectionMetadata) > constants.stringLimit || (launch.settings.itemMetadata && byteLength(launch.settings.itemMetadata) > constants.stringLimit) || !isProceedsAddress(launch.settings.mintTo)) throw Error("The saved metadata or recipient no longer passes the current runtime limits. Nothing was submitted.");
    const at = await api.at(await api.rpc.chain.getFinalizedHead());
    const [profile, item] = await Promise.all([readCollectionProfile(at as unknown as ApiPromise, launch.collectionId!), readItemProfile(at as unknown as ApiPromise, launch.collectionId!, String(launch.settings.itemId))]);
    if (!profile.found || !sameAccount(profile.owner, payer)) throw Error("Only the current collection owner can resume this launch.");
    if (item.found) throw Error("This item already exists. Inspect the previous finishing receipt instead of minting it again.");
  }
  async function clear() {
    let lease: Lease | null = null;
    try { if (!key) return false; lease = await acquireLease(`portova:nft:${key}`, navigator.locks); save(null, true); invalid.current.delete(key); rerender(value => value + 1); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The checkpoint could not be cleared."); return false; }
    finally { lease?.release(); }
  }
  return { launch, stage: launchStage(launch), ready: !!key && loaded === key && !invalid.current.has(key), hasInvalidCheckpoint: !!key && invalid.current.has(key), checking, error, acquire, checkpointCurrent, begin, update, assertCanFinish, recover: () => recover(), clear };
}
