import { checkAddress, decodeAddress, encodeAddress } from "@polkadot/util-crypto";
import { parseDecimalToPlanck } from "./format.ts";

export type WithdrawalContext = { account: string | null; source: string | null; proceeds: string; genesisHash: string | null; live: boolean };
export type WithdrawalRequest = { sender: string; source: string; destination: string; amount: bigint; genesisHash: string; key: string };
export function sameAccount(left: string | null | undefined, right: string | null | undefined): boolean {
  try { return !!left && !!right && encodeAddress(decodeAddress(left), 42) === encodeAddress(decodeAddress(right), 42); }
  catch { return false; }
}
export function validDestination(address: string): boolean {
  try { return checkAddress(address, 42)[0]; } catch { return false; }
}
export function prepareWithdrawal(context: WithdrawalContext, destination: string, amount: string, expectedGenesis: string): WithdrawalRequest | string {
  if (!context.account || !context.source) return "Connect the proceeds account before reviewing a withdrawal.";
  if (!context.proceeds || !sameAccount(context.account, context.proceeds)) return "Only the linked proceeds account can authorize this withdrawal.";
  if (!context.live || context.genesisHash !== expectedGenesis) return "The verified Portaldot testnet connection is required.";
  const dest = destination.trim();
  if (!validDestination(dest)) return "Enter a valid prefix-42 Substrate destination address.";
  if (sameAccount(dest, context.proceeds)) return "Choose a different destination account.";
  const debit = parseDecimalToPlanck(amount, 14);
  if (debit === null || debit <= 0n) return "Enter a tPOT amount above zero with at most 14 decimal places.";
  const sender = encodeAddress(decodeAddress(context.account), 42);
  return { sender, source: context.source, destination: dest, amount: debit, genesisHash: expectedGenesis,
    key: [expectedGenesis, sender, context.source, dest, debit.toString()].join("|") };
}
export function withdrawalStillCurrent(request: WithdrawalRequest, context: WithdrawalContext, destination: string, amount: string): boolean {
  const current = prepareWithdrawal(context, destination, amount, request.genesisHash);
  return typeof current !== "string" && current.key === request.key;
}

/** Both checks are needed: resolving an extension is asynchronous and can outlive account changes. */
export async function guardedWallet<TSigner, TResult>(input: {
  current: () => boolean; open: () => Promise<TSigner>; submit: (signer: TSigner, current: () => boolean) => Promise<TResult>;
}): Promise<TResult> {
  if (!input.current()) throw new Error("The account or withdrawal changed. Review it again.");
  const signer = await input.open();
  if (!input.current()) throw new Error("The account or withdrawal changed. Nothing was submitted.");
  return input.submit(signer, input.current);
}
