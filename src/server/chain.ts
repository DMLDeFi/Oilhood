import "server-only";
import { createPublicClient, erc20Abi, http, isAddress, type Address } from "viem";
import { robinhood } from "viem/chains";
import { BURN_ADDRESSES, creatorWallet, tokens } from "@/config/site";
import { getMeta, setMeta } from "./db";

const rpcUrl = process.env.RPC_URL || robinhood.rpcUrls.default.http[0];

/** Chain id comes from RPC_CHAIN_ID so the indexer can be tested against a local node. */
const chain = process.env.RPC_CHAIN_ID
  ? { ...robinhood, id: Number(process.env.RPC_CHAIN_ID), rpcUrls: { default: { http: [rpcUrl] } } }
  : robinhood;

export const client = createPublicClient({
  chain,
  transport: http(rpcUrl, { batch: { batchSize: 50 }, retryCount: 3, timeout: 15_000 }),
});

export const token = tokens.oilhood;

/** First block to index (the token's deploy block). Avoids scanning the chain from genesis. */
export const startBlock = BigInt(process.env.OILHOOD_START_BLOCK || "0");

function list(env: string | undefined): Address[] {
  return (env || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Address => isAddress(s))
    .map((s) => s.toLowerCase() as Address);
}

/** Pools / bonding curves that $OILHOOD trades against. Buys come out of these, sells go into them. */
export const configuredPools = list(process.env.OILHOOD_POOLS);

export const burnSet = new Set(BURN_ADDRESSES.map((a) => a.toLowerCase()));

/** Addresses that never get a rig (pools, burn, creator). */
export function excluded(pools: string[]) {
  return new Set([...burnSet, ...pools, ...(creatorWallet ? [creatorWallet.toLowerCase()] : [])]);
}

/** Token decimals, read once from the contract and cached in the meta table. */
export async function tokenDecimals() {
  const cached = await getMeta("token.decimals");
  if (cached) return Number(cached);
  const d = await client.readContract({ address: token!, abi: erc20Abi, functionName: "decimals" });
  await setMeta("token.decimals", String(d));
  return d;
}
