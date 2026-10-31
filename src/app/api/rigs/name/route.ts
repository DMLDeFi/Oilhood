import { isAddress } from "viem";
import { client } from "@/server/chain";
import { hasDb, sql } from "@/server/db";
import { rigNameMessage, validRigName } from "@/lib/rigs";

/** Name your rig: the wallet signs a message proving ownership. Supports smart wallets (ERC-1271). */
export async function POST(req: Request) {
  if (!hasDb) return Response.json({ error: "Rigs are not live yet" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { address?: string; name?: string; issuedAt?: string; signature?: `0x${string}` } | null;
  const { address, name, issuedAt, signature } = body ?? {};
  if (!address || !isAddress(address) || !name || !issuedAt || !signature) return Response.json({ error: "Missing fields" }, { status: 400 });
  if (!validRigName(name)) return Response.json({ error: "Use 3–20 letters, numbers, spaces, - or _" }, { status: 400 });
  const age = Date.now() - new Date(issuedAt).getTime();
  if (!(age >= -60_000 && age < 10 * 60_000)) return Response.json({ error: "Signature expired, try again" }, { status: 400 });

  const ok = await client
    .verifyMessage({ address, message: rigNameMessage(address, name, issuedAt), signature })
    .catch(() => false);
  if (!ok) return Response.json({ error: "Signature does not match this wallet" }, { status: 401 });

  const a = address.toLowerCase();
  const [rig] = await sql()`select 1 from rigs where address = ${a} and points > 0`;
  if (!rig) return Response.json({ error: "Your rig appears after its first scored hour of holding $OILHOOD" }, { status: 404 });
  const [taken] = await sql()`select 1 from rigs where lower(name) = lower(${name.trim()}) and address <> ${a}`;
  if (taken) return Response.json({ error: "That name is taken" }, { status: 409 });
  await sql()`update rigs set name = ${name.trim()} where address = ${a}`;
  return Response.json({ ok: true, name: name.trim() });
}
