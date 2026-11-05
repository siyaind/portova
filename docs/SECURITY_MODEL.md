# Security model

This describes implementation boundaries. It is not an independent audit or a mainnet security certification.

## Keys and authority

The injected wallet holds signing keys. Portova never requests a seed/private key. Genesis and reviewed-runtime checks guard native transaction access. EVM and Substrate identities remain separate.

On-chain permissions come from the runtime. Treasury requires the linked proceeds authority, canonical account matching, a valid prefix-42 recipient and a keep-alive transfer. Cloud owner/editor/viewer roles do not grant asset authority.

## Review and submission

Amounts use integer arithmetic and strict decimal/u128 parsing. Preflight reads finalized balances, frozen funds, existential deposit and required deposits. The fee budget reserves max(4383 planck, 10% of the estimate) and refuses marginal remaining headroom. This is a cautious policy, not a proven fee maximum.

Every signing flow binds its operation to the originating account, extension, genesis, runtime, connection, mount lifetime and draft revision. Checks run before signing and after asynchronous validation before broadcast. Disconnect invalidates late permission/account results. Explicit disconnect persists within the tab's session.

Treasury, swap and liquidity reviews expire. Swap retains the reviewed minimum and requires a fresh quote to cover it. Balance errors are shown even without a quote; any placeholder minimum used for fee estimation is never signed or submitted. Required balance/fee reads fail closed. NFT creation uses durable, wallet-bound checkpoints and ownership/item checks before resuming.

These guards reduce avoidable failures. Runtime races can still cause a submitted call to fail and pay a fee.

## Receipt trust

Finalized success requires matching dispatch evidence for the correct extrinsic in canonical finalized chain state. Another extrinsic's event cannot confirm it. Unknown/no-hash outcomes remain unknown; recover before retrying. Late callbacks cannot demote terminal outcomes.

Imports are size/schema/network checked. Imported success, payer and charged-fee claims require re-verification. Identity matching prevents repeated backups from duplicating receipts; legacy V3 rows without genesis are treated as V3 only for identity comparison. Explicit other networks stay separate. Missing/pruned history stays unverified.

## Cloud authorization and publication

Wallet messages bind origin, account, action, normalized payload and nonce. Single-use authorization and database mutations are atomic, with retained results for identical verified retries. Revision checks, quotas and accepted invitations are enforced server-side. Revoked users cannot continue writing from a stale tab.

Publishing is explicit; private/hidden records are excluded from public reads. Evidence is tied to revision/network and is distinct from operator review. Public data already downloaded and on-chain history cannot be recalled. Browser drafts/receipts are not encrypted custody or a server backup.

## Service boundaries

Required public/cloud endpoints use Redis rate controls; identifiers use salted trusted-proxy digests. Production documents use per-request CSP nonces, framing restrictions and other response headers. Server secrets are never public environment variables. Operational endpoints require a private bearer secret. Workers read chain state and never sign or broadcast.

Disabled crypto checkout remains guarded by release policy and environment configuration. Its verification code binds the invoice, payer, exact canonical finalized USDC transfer, recipient, amount and time window. Credits are unique/idempotent; there are no allowances, merchant signing keys or automated debits. Payment code is retained because it is referenced and tested, but code presence does not mean checkout is active.

Mainnet, embedded bridging and automatic revenue routing are not implemented. RPC availability, runtime administration, provider quotas, index coverage and best-effort scheduling remain operational dependencies.

See [QA](submission/QA.md) for accepted/unverified scenarios and the [runbook](PRODUCTION_RUNBOOK.md) for backups, incidents and real-value launch gates.
