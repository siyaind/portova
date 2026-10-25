// Public, read-only reconstruction. Original wallet quotes are not invented.
import { ApiPromise, WsProvider } from "@polkadot/api";
import { writeFile } from "node:fs/promises";
const blocks = [154574, 154647, 159687, ...process.argv.slice(2).map(Number)];
const timer = setTimeout(() => process.exit(1), 120_000);
let api;
let provider;
try {
  provider = new WsProvider("wss://test-node-v3.portaldot.dev", 2500);
  api = await ApiPromise.create({ provider });
  if (api.genesisHash.toHex() !== "0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd") throw Error("Unexpected testnet genesis.");
  const measurements = [];
  for (const height of [...new Set(blocks)]) {
    if (!Number.isSafeInteger(height) || height < 1) throw Error("Use positive inclusion block numbers.");
    const hash = await api.rpc.chain.getBlockHash(height), block = await api.rpc.chain.getBlock(hash);
    const parent = block.block.header.parentHash, at = await api.at(parent);
    const events = await api.query.system.events.at(hash);
    const version = await api.rpc.state.getRuntimeVersion(parent);
    for (let index = 0; index < block.block.extrinsics.length; index++) {
      const tx = block.block.extrinsics[index]; if (!tx.isSigned) continue;
      const feeEvent = events.find(row => row.phase.isApplyExtrinsic && row.phase.asApplyExtrinsic.toNumber() === index && row.event.section === "transactionPayment" && row.event.method === "TransactionFeePaid");
      if (!feeEvent) continue;
      let reconstructedFee = null;
      try { const quote = await provider.send("payment_queryInfo", [tx.toHex(), parent.toHex()]); if (/^\d+$/.test(String(quote.partialFee))) reconstructedFee = String(quote.partialFee); } catch { /* Missing archive/runtime calls remain unknown. */ }
      const signerJson = tx.signer.toJSON();
      const signer = typeof signerJson === "string" ? signerJson : signerJson?.id ?? signerJson?.Id ?? null;
      let accountBefore = null;
      if (signer) { try { accountBefore = (await at.query.system.account(signer)).toJSON(); } catch { /* Unknown address mappings remain explicit. */ } }
      const actualFee = feeEvent.event.data[1].toString();
      measurements.push({ height, blockHash: hash.toHex(), index, hash: tx.hash.toHex(), call: `${tx.method.section}.${tx.method.method}`, signer, signerEncoding: signerJson, runtime: `${version.specName}:${version.specVersion}`, signedBytes: tx.encodedLength,
        reconstructedSignedQueryInfo: reconstructedFee, actualFee, tip: feeEvent.event.data[2]?.toString() ?? null,
        reconstructedDifference: reconstructedFee && BigInt(reconstructedFee) > 0n ? (BigInt(actualFee) - BigInt(reconstructedFee)).toString() : null,
        originalWalletEstimate: null, accountBefore });
    }
  }
  const result = { capturedAt: new Date().toISOString(), genesisHash: api.genesisHash.toHex(), method: "Reconstructed signed queryInfo at parent state compared with inclusion TransactionFeePaid. These are not original wallet paymentInfo quotes.", measurements };
  await writeFile("docs/submission/fee-measurements.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ count: measurements.length, calls: [...new Set(measurements.map(row => row.call))], runtimes: [...new Set(measurements.map(row => row.runtime))] }));
} finally { clearTimeout(timer); await api?.disconnect(); }
