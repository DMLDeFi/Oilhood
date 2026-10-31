/** Virtual Rigs rules, shared by the scoring engine and the UI. */

export const TIERS = [
  { id: 0, name: "Prospector", min: 0, rate: 0, icon: "🔍" },
  { id: 1, name: "Pumpjack", min: 0.1, rate: 1, icon: "🛢" },
  { id: 2, name: "Land Rig", min: 1, rate: 3, icon: "🏗" },
  { id: 3, name: "Offshore Platform", min: 10, rate: 8, icon: "🌊" },
  { id: 4, name: "Deepwater Rig", min: 100, rate: 20, icon: "⚓" },
  { id: 5, name: "Supertanker", min: 1000, rate: 50, icon: "🚢" },
] as const;

/** Full multiplier after this many hours without selling or sending tokens out. */
export const STEADY_HOURS = 168;
export const GUSHER_BONUS = 1.25;

export function tierFor(barrels: number) {
  let t: (typeof TIERS)[number] = TIERS[0];
  for (const tier of TIERS) if (barrels >= tier.min) t = tier;
  return t;
}

export function nextTier(barrels: number) {
  return TIERS.find((t) => t.min > barrels) ?? null;
}

/** 1x when you just bought or sold, rising linearly to 2x after a week of holding. */
export function steadyMultiplier(holdHours: number) {
  return 1 + Math.min(Math.max(holdHours, 0), STEADY_HOURS) / STEADY_HOURS;
}

/**
 * Points a rig earns for one hour.
 * - Tier sets the base rate (bigger rig, more output).
 * - Size bonus grows logarithmically, so whales can't simply buy the leaderboard.
 * - Steady hands: up to 2x for holding without selling.
 * - Gusher hour: +25% when WTI closed the hour higher than it opened.
 */
export function pointsPerHour(barrels: number, holdHours: number, gusher: boolean) {
  const tier = tierFor(barrels);
  if (!tier.rate) return 0;
  const size = 1 + 0.25 * Math.log10(1 + barrels);
  return tier.rate * size * steadyMultiplier(holdHours) * (gusher ? GUSHER_BONUS : 1);
}

export function validRigName(name: string) {
  return /^[A-Za-z0-9 _-]{3,20}$/.test(name.trim());
}

/** Exact message a wallet signs to name its rig (also rebuilt server-side to verify). */
export function rigNameMessage(address: string, name: string, issuedAt: string) {
  return `OilHood Virtual Rigs\n\nName my rig: "${name.trim()}"\nWallet: ${address.toLowerCase()}\nIssued: ${issuedAt}\n\nThis signature is free and does not move any funds.`;
}
