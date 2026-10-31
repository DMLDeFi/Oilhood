"use client";

import { useQuery } from "@tanstack/react-query";
import type { MarketResponse, NewsItem, TokenResponse } from "@/lib/types";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

export function useMarket() {
  return useQuery({ queryKey: ["market"], queryFn: () => get<MarketResponse>("/api/market"), refetchInterval: 60_000 });
}

export function useTokens() {
  return useQuery({ queryKey: ["tokens"], queryFn: () => get<TokenResponse>("/api/token"), refetchInterval: 30_000 });
}

export function useNews() {
  return useQuery({
    queryKey: ["news"],
    queryFn: () => get<{ items: NewsItem[]; live: boolean }>("/api/news"),
    refetchInterval: 10 * 60_000,
  });
}

export interface LiveTrade { id: string; kind: "buy" | "sell"; ts: string; tx: string; trader: string; amount: number; usd: number | null; barrels: number | null }
export interface LiveData {
  enabled: boolean;
  reason?: string;
  stats?: {
    price: number | null; change24h: number | null; ath: number | null; volume24h: number; buys24h: number; sells24h: number;
    traders24h: number; holders: number; marketCap: number | null;
  };
  trades?: LiveTrade[];
  holders?: { address: string; amount: number; pct: number; label: string | null }[];
}

export function useLive() {
  return useQuery({ queryKey: ["live"], queryFn: () => get<LiveData>("/api/live"), refetchInterval: 5000 });
}

export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }

export function useCandles(tf: string, enabled: boolean) {
  return useQuery({
    queryKey: ["candles", tf],
    queryFn: () => get<{ candles: Candle[] }>(`/api/chart?tf=${tf}`),
    refetchInterval: 30_000,
    enabled,
  });
}

export interface RigRow { rank: number; address: string; name: string | null; points: number; rate: number; barrels: number; tier: number }
export interface RigsData {
  enabled: boolean;
  rigs?: RigRow[];
  active?: number;
  total?: number;
  lastEpoch?: { ts: string; gusher: boolean } | null;
  rig?: { address: string; name: string | null; points: number; rate: number; barrels: number; tier: number; rank: number | null; holdingSince: string | null } | null;
}

export function useRigs(address?: string) {
  return useQuery({
    queryKey: ["rigs", address ?? null],
    queryFn: () => get<RigsData>(`/api/rigs${address ? `?address=${address}` : ""}`),
    refetchInterval: 60_000,
  });
}
