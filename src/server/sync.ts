import "server-only";
import { token } from "./chain";
import { getMeta, hasDb, migrate, setMeta, sql } from "./db";
import { getPools, indexTransfers, reclassify } from "./indexer";
import { snapshotPrice } from "./prices";
import { processEpochs } from "./rigs";

const LEASE_MS = 55_000;

/** Takes a short lease in the meta table so concurrent syncs (cron + visitors) never overlap. */
async function acquire(now: Date) {
  const until = new Date(now.getTime() + LEASE_MS).toISOString();
  const rows = await sql()`
    insert into meta (key, value) values ('sync.lease', ${until})
    on conflict (key) do update set value = excluded.value
    where meta.value < ${now.toISOString()}
    returning key`;
  return rows.length > 0;
}

async function release() {
  await sql()`update meta set value = '1970-01-01T00:00:00.000Z' where key = 'sync.lease'`;
}

/** One sync pass: price snapshot → pool re-labelling → transfer indexing → rig scoring. */
export async function runSync({ budgetMs = 8000, now = new Date() } = {}) {
  if (!hasDb || !token) return { ok: false, reason: !hasDb ? "DATABASE_URL not set" : "token address not set" };
  await migrate();
  if (!(await acquire(now))) return { ok: false, reason: "another sync is running" };
  const started = Date.now();
  try {
    const price = await snapshotPrice(now);
    const relabeled = await reclassify(await getPools());
    const index = await indexTransfers(budgetMs);
    const rigs = await processEpochs(now);
    await setMeta("sync.last", new Date().toISOString());
    return { ok: true, ms: Date.now() - started, price, relabeled, index, rigs };
  } finally {
    await release();
  }
}

/** True when the last sync is older than `maxAgeMs` (used to trigger syncs from page traffic). */
export async function isStale(maxAgeMs = 30_000) {
  if (!hasDb || !token) return false;
  await migrate();
  const last = await getMeta("sync.last");
  return !last || Date.now() - new Date(last).getTime() > maxAgeMs;
}
