# Security model

Updated October 24, 2026. This is an implementation description, not an audit.

## Authority and network

The user's injected wallet holds the key. Portova never requests a seed or private key. ChainProvider verifies the expected testnet genesis and runtime name before marking the connection live. The rollout does not silently switch users to mainnet. EVM addresses and native Substrate accounts remain distinct.

Treasury permits only the linked proceeds authority to review a withdrawal. Canonical public-key comparison handles alternate SS58 encodings, while recipients must be valid prefix-42 addresses. The transfer keeps the sender alive. It cannot withdraw somebody else's funds or bypass chain permissions.

## Review and broadcast

Amounts use integer arithmetic and strict decimal/u128 parsing. Preflight reads finalized account state, frozen funds, existential deposit, deposits and guarded fees. Unknown or insufficient values stop before the wallet. Guards reduce avoidable failures; runtime dispatch can still fail.

Treasury requires a separate confirmation after review, with a 60-second limit. Network, sender, extension, project proceeds account, recipient and amount are checked across asynchronous wallet access. The exact reviewed call is signed, revalidated and then broadcast. Permission changes revoke the active selection. Disconnect invalidates late connection results. Double submission is blocked while an action is pending.

Swaps check a fresh runtime quote against the reviewed minimum, with a quote expiry. NFT Trading remains disabled unless the runtime explicitly enables it. Issuer and collection permissions remain runtime authorities, not frontend promises.

## Receipt evidence

Inclusion is not finality. A finalized label requires successful dispatch for this extrinsic index and canonical finality. Another extrinsic's success cannot confirm it. Unknown/no-hash outcomes remain Unknown and must be checked before retrying. Late callbacks cannot demote confirmed receipts.

Recovery saves inclusion hints and bounded search checkpoints. RPC calls have time bounds. Pruned history is unverified. Imported JSON is size/schema/network checked, rendered as plain React text, and cannot confer successful status without rechecking the chain. Explorer paths accept validated identifiers only.

## Storage and operational limits

Projects and receipts are browser-local, not encrypted custody or a server archive. Export backups before clearing site data. Storage failure is surfaced with an export link. Portova operates no indexer, faucet or bridge. Public RPC availability and testnet administration remain external dependencies.

Automated wallet tests use fake adapters and execute the actual submission helper. Read-only evidence capture queries the public chain. No human extension signature or new treasury transfer was executed in this update. See [QA](submission/QA.md) for the remaining manual checks.
