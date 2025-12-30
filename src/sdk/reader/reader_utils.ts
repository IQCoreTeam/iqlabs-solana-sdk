import { PublicKey } from "@solana/web3.js";
import { getConnection } from "../utils/connection_helper";

export async function fetchAccountTransactions(
  account: string | PublicKey,
  options: { before?: string; limit?: number } = {},
) {
  const { before, limit } = options;
  if (typeof limit === "number" && limit <= 0) {
    return [];
  }

  const pubkey = typeof account === "string" ? new PublicKey(account) : account;
  return getConnection().getSignaturesForAddress(pubkey, { before, limit });
}
