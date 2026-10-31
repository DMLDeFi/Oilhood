import type { NextRequest } from "next/server";
import { hasDb } from "@/server/db";
import { token } from "@/server/chain";
import { getCandles, isTimeframe } from "@/server/queries";

export async function GET(req: NextRequest) {
  if (!hasDb || !token) return Response.json({ candles: [] });
  const tf = req.nextUrl.searchParams.get("tf");
  const candles = await getCandles(isTimeframe(tf) ? tf : "15m");
  return Response.json({ candles }, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" } });
}
