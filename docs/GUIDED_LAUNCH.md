# Guided launch

Use `/launch` to create a native token or NFT collection, or `/import` to link an existing project. Connecting or opening a step does not submit a transaction.

## Create a project

1. Save a project name and choose token or NFT. A token plan can include optional liquidity. The initial plan and form drafts stay in browser storage.
2. Connect a compatible Substrate wallet. Review the verified network, finalized spendable balance, fees and reserved deposits.
3. Use the token/NFT form. Each on-chain operation requires explicit approval. NFT collection setup has a durable two-stage checkpoint so the authorized account can resume an interrupted launch.
4. After successful finality, link the assigned object to the originating project. Changed account/project context or a conflicting existing link prevents automatic attachment. Its transaction receipt remains available for inspection.
5. Optionally create/link a native pool and separately review a liquidity deposit. An empty pool is not usable liquidity. Pool setup fees and reserved account deposits are distinct.
6. Inspect Studio/Launch Health, save privately to the cloud if desired, and publish only when ready. Dated role evidence and example labels remain separate from operator review.

## Import an existing project

Connect the publishing wallet, enter linked object IDs and review finalized chain-role matches. Import reads state and links IDs; it does not transfer assets or establish that Portova originally launched them. Replacing the current local draft requires acknowledgement. Save the old draft privately if it must be retained.

## Persistence and safeguards

Description, publication/example settings and linked IDs survive refresh/navigation. Unsaved local edits do not change the published cloud revision. Loading the latest cloud record deliberately replaces the local copy.

Signing guards bind account, extension, network, runtime and reviewed inputs. Changing those invalidates an outstanding review. Browser locks coordinate supported same-origin tabs; they cannot coordinate another device's wallet. A transaction already broadcast must be recovered/checked before retrying.

Launch Health reports finalized roles, supply/holder coverage, pool reserves and LP share. Outside-issuer balance is not verified circulating supply. Its swap scenario excludes fees and is not an executable quote. A linked proceeds account is a balance/withdrawal reference, not automatic sales attribution or revenue routing.

See [cloud workspaces](CLOUD_PROJECTS.md), [security](SECURITY_MODEL.md) and [accepted testnet scenarios](submission/QA.md).
