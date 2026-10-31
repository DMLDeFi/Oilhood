import { after } from "next/server";
import { hasDb } from "@/server/db";
import { token } from "@/server/chain";
import { getHolders, getStats, getTrades } from "@/server/queries";
import { isStale, runSync } from "@/server/sync";

export const maxDuration = 30;

/** Live $OILHOOD data for the Terminal: stats, latest trades, top holders. */
export async function GET() {
  if (!hasDb || !token) {
    return Response.json({ enabled: false, reason: !token ? "prelaunch" : "no-database" });
  }
  // Page traffic keeps the index fresh between scheduled syncs.
  if (await isStale()) after(() => runSync().catch((e) => console.error("sync failed", e)));
  const [stats, trades, holders] = await Promise.all([getStats(), getTrades(40), getHolders(12)]);
  return Response.json(
    { enabled: true, stats, trades, holders },
    { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=20" } },
  );
}
