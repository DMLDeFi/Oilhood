import { runSync } from "@/server/sync";

export const maxDuration = 60;

/**
 * Scheduled sync. Called by the GitHub Actions workflow and Vercel Cron.
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runSync({ budgetMs: 45_000 });
  return Response.json(result, { status: result.ok || result.reason === "another sync is running" ? 200 : 500 });
}
