import "server-only";
import postgres from "postgres";

declare global {
  var __oilhoodSql: postgres.Sql | undefined;
  var __oilhoodMigrated: Promise<void> | undefined;
}

export const hasDb = !!process.env.DATABASE_URL;

/** Shared postgres.js client. `prepare: false` keeps it compatible with Neon/PgBouncer pooling. */
export function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  globalThis.__oilhoodSql ??= postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    types: { bigint: postgres.BigInt },
    onnotice: () => {},
  });
  return globalThis.__oilhoodSql;
}

const SCHEMA = /* sql */ `
create table if not exists meta (
  key text primary key,
  value text not null
);

-- Every $OILHOOD Transfer event. amount is raw token units (no decimals applied).
create table if not exists transfers (
  id bigserial primary key,
  block bigint not null,
  ts timestamptz not null,
  tx text not null,
  log_index int not null,
  from_addr text not null,
  to_addr text not null,
  amount numeric(78, 0) not null,
  kind text not null,            -- buy | sell | transfer | mint | burn
  trader text,                   -- the wallet on the other side of the pool for buys/sells
  price_usd double precision,    -- $OILHOOD price at the time, if known
  unique (tx, log_index)
);
create index if not exists transfers_ts on transfers (ts desc);
create index if not exists transfers_from on transfers (from_addr, ts);
create index if not exists transfers_to on transfers (to_addr, ts);
create index if not exists transfers_kind_ts on transfers (kind, ts desc);

-- Current balance ledger, maintained incrementally from transfers.
create table if not exists balances (
  address text primary key,
  balance numeric(78, 0) not null default 0,
  first_in timestamptz,
  last_out timestamptz
);
create index if not exists balances_balance on balances (balance desc);

-- Price history: $OILHOOD (USD) and WTI (USD/bbl), one row per snapshot.
create table if not exists prices (
  ts timestamptz primary key,
  price_usd double precision,
  wti double precision,
  source text
);

-- Virtual Rigs.
create table if not exists rigs (
  address text primary key,
  name text,
  points double precision not null default 0,
  last_rate double precision not null default 0,
  last_barrels double precision not null default 0,
  last_tier int not null default 0,
  updated_at timestamptz
);
create index if not exists rigs_points on rigs (points desc);

create table if not exists epochs (
  ts timestamptz primary key,      -- end of the hour that was scored
  price_usd double precision,
  wti_open double precision,
  wti_close double precision,
  rigs int not null default 0,
  points double precision not null default 0,
  note text
);
`;

/** Creates tables on first use. Safe to call on every request; runs once per instance. */
export function migrate() {
  globalThis.__oilhoodMigrated ??= sql()
    .unsafe(SCHEMA)
    .then(() => undefined)
    .catch((e) => {
      globalThis.__oilhoodMigrated = undefined;
      throw e;
    });
  return globalThis.__oilhoodMigrated;
}

export async function getMeta(key: string) {
  const [row] = await sql()`select value from meta where key = ${key}`;
  return (row?.value as string | undefined) ?? null;
}

export async function setMeta(key: string, value: string) {
  await sql()`insert into meta (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value`;
}
