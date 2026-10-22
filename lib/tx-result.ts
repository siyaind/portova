export type TxStatus = "signing" | "submitted" | "included" | "finalized" | "failed" | "ambiguous";

export type ChainMatch =
  | "pending"
  | "finalized"
  | "included"
  | "failed"
  | "dispatch-unknown"
  | "not-found"
  | "unchecked";

export function txResultMessage(status: TxStatus, error?: string | null): string {
  if (status === "failed") return error || "The transaction failed.";
  if (status === "finalized") return "Finalized.";
  if (status === "ambiguous") {
    return error || "The outcome is unknown. This is not proof the transaction failed.";
  }
  if (status === "included") {
    return error || "Included. Finalization was not confirmed on chain.";
  }
  if (status === "submitted") {
    return error || "Submitted. Inclusion was not confirmed on chain. This is not a final result.";
  }
  return "Waiting for the wallet.";
}

export function outcomeAfterWait(input: {
  hash?: string;
  sawIncluded: boolean;
  chain: ChainMatch;
}): { status: TxStatus; hash?: string; error?: string } {
  if (!input.hash) {
    return {
      status: "ambiguous",
      error: "No transaction hash was returned. The outcome is unknown, and this is not proof the transaction failed.",
    };
  }
  if (input.chain === "failed") {
    return {
      status: "failed",
      hash: input.hash,
      error: "The block contains system.ExtrinsicFailed for this extrinsic.",
    };
  }
  if (input.chain === "dispatch-unknown") {
    return {
      status: "ambiguous",
      hash: input.hash,
      error: "The extrinsic is in a block, but system.ExtrinsicSuccess was not read. It is not marked successful.",
    };
  }
  if (input.chain === "finalized") return { status: "finalized", hash: input.hash };
  if (input.chain === "included") {
    return {
      status: "included",
      hash: input.hash,
      error: "The extrinsic is in a block that is not finalized yet.",
    };
  }
  if (input.chain === "pending") {
    return {
      status: "submitted",
      hash: input.hash,
      error: "The extrinsic is still in the node pool. Inclusion was not reported.",
    };
  }
  if (input.chain === "not-found") {
    return {
      status: "ambiguous",
      hash: input.hash,
      error: "The hash was not in the node pool or the recent blocks. The outcome was not determined.",
    };
  }
  if (input.sawIncluded) {
    return {
      status: "included",
      hash: input.hash,
      error: "Included. A later check against the chain did not finish, so finalization is not confirmed.",
    };
  }
  return {
    status: "submitted",
    hash: input.hash,
    error: "Submitted. A later check against the chain did not finish. This is not a final result.",
  };
}

export function signingLabel(phase: TxStatus | null, idle: string): string {
  if (phase === "submitted") return "Submitted";
  if (phase === "included") return "Included";
  if (phase === "finalized") return "Finalized";
  if (phase === "ambiguous") return "Unknown";
  if (phase === "failed") return "Failed";
  if (phase === "signing") return "Waiting for the wallet…";
  return idle;
}

export function outcomeWithoutHash(error: string): { status: "ambiguous"; error: string } {
  const detail = error.trim();
  return {
    status: "ambiguous",
    error: detail
      ? `${detail} No hash was returned, so this is not recorded as a failed transaction.`
      : "No transaction hash was returned. The outcome is unknown, and this is not proof the transaction failed.",
  };
}

export function statusWithoutHash(status: TxStatus): TxStatus {
  if (status === "signing" || status === "submitted") return "ambiguous";
  return status;
}
