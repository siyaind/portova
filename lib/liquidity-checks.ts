import type { ApiPromise } from "@polkadot/api";
import type { PoolView } from "./pools";
import { assetRemainder } from "./liquidity-math.ts";

export function depositMinimumError(amount: bigint, reserve: bigint, minimum: bigint): string | null {
  return amount <= 0n ? "Deposit amounts must be above zero." : reserve + amount < minimum ? "This deposit leaves the pool below the asset's minimum balance. Increase the deposit before signing." : null;
}
export async function checkLiquidityDeposit(api: ApiPromise, pool: PoolView, account: string, amount1: bigint, amount2: bigint, blockHash: string) {
  const at = await api.at(blockHash);
  for (const [i, side] of [pool.asset1, pool.asset2].entries()) {
    const amount = i === 0 ? amount1 : amount2;
    const reserveText = i === 0 ? pool.reserve1 : pool.reserve2;
    const reserve = reserveText === null && pool.lpSupply === "0" ? 0n : reserveText !== null ? BigInt(reserveText) : null;
    if (reserve === null) throw Error("Pool reserves are unavailable. Refresh before depositing.");
    if (side.kind === "native") {
      const error = depositMinimumError(amount, reserve, BigInt(at.consts.balances.existentialDeposit.toString()));
      if (error) throw Error(error); continue;
    }
    const [details, holding] = await Promise.all([at.query.assets.asset(side.id), at.query.assets.account(side.id, account)]);
    const asset = details.toJSON() as { minBalance: string | number; status: string } | null;
    const balance = holding.toJSON() as { balance: string | number; status: string } | null;
    if (!asset || asset.status.toLowerCase() !== "live" || !balance || balance.status.toLowerCase() !== "liquid") throw Error(`Asset #${side.id} is missing, frozen, or unavailable to this account.`);
    const minimum = BigInt(asset.minBalance), error = depositMinimumError(amount, reserve, minimum);
    if (error) throw Error(`Asset #${side.id}: ${error}`);
    const remainder = assetRemainder(BigInt(balance.balance), amount, minimum);
    if (remainder !== "ok") throw Error(remainder === "short" ? `Not enough asset #${side.id} for this deposit.` : `This deposit leaves asset #${side.id} below its account minimum.`);
  }
}
