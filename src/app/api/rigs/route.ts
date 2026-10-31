import type { NextRequest } from "next/server";
import { isAddress } from "viem";
import { hasDb } from "@/server/db";
import { token } from "@/server/chain";
import { getLeaderboard, getRig } from "@/server/queries";

export async function GET(req: NextRequest) {
  if (!hasDb || !token) return Response.json({ enabled: false });
  const address = req.nextUrl.searchParams.get("address");
  const [board, rig] = await Promise.all([
    getLeaderboard(50),
    address && isAddress(address) ? getRig(address) : null,
  ]);
  return Response.json({ enabled: true, ...board, rig }, { headers: { "Cache-Control": "private, max-age=10" } });
}
