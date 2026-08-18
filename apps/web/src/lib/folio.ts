export const folio = [
  { href: "/", label: "Brief", tab: "Brief", for: "the case", leaf: "brief" },
  { href: "/gates", label: "Gates", tab: "Gates", for: "Scout’s quality", leaf: "gates" },
  { href: "/evidence", label: "Evidence", tab: "Log", for: "the agent at work", leaf: "evidence" },
  { href: "/field", label: "Field", tab: "Field", for: "explorers + PNK", leaf: "field" },
  { href: "/hand", label: "Hand", tab: "Hand", for: "the operator", leaf: "hand" },
] as const;

export type LeafId = (typeof folio)[number]["leaf"];

export const parties = [
  {
    id: "explorers",
    who: "Explorers",
    href: "/field",
    outcome: "A human name where the scan only showed a hex.",
  },
  {
    id: "scout",
    who: "Kleros Scout",
    href: "/gates",
    outcome: "Policy-clean items. Junk never spends the 51.6 xDAI.",
  },
  {
    id: "operator",
    who: "Operator",
    href: "/hand",
    outcome: "PNK from the monthly pools if the 84 hours pass.",
  },
] as const;

/** Keyboard / prefetch walk — five leaves. Gate pages have their own prev/next. */
export const walk = ["/", "/gates", "/evidence", "/field", "/hand"] as const;

export const registries = [
  {
    key: "addressTags",
    label: "Address Tags",
    serves: "Explorers",
    pool: "100,000",
    max: "500 PNK",
    contract: "0x66260C69d03837016d88c9877e61e08Ef74C59F2",
    gate: "needs an explorer gap",
  },
  {
    key: "tokens",
    label: "Token Registry",
    serves: "Wallets",
    pool: "100,000",
    max: "500 PNK",
    contract: "0xeE1502e29795Ef6C2D60F8D7120596abE3baD990",
    gate: "needs an explorer gap",
  },
  {
    key: "cdn",
    label: "Contract Domains",
    serves: "Projects",
    pool: "100,000",
    max: "500 PNK",
    contract: "0x957A53A994860BE4750810131d9c876b2f52d6E1",
    gate: "no explorer gate",
  },
  {
    key: "atq",
    label: "Address Tag Queries",
    serves: "Tooling",
    pool: "60,000",
    max: "3,000 PNK",
    contract: "0xAe6aaed5434244be3699c56E7Ebc828194F26dc3",
    gate: "no explorer gate",
  },
] as const;

export const chains = [
  { id: "gnosis", label: "Gnosis", role: "settlement · addItem · 51.6 xDAI" },
  { id: "ethereum", label: "Ethereum", role: "discovery" },
  { id: "base", label: "Base", role: "discovery · x402 pin" },
  { id: "arbitrum", label: "Arbitrum", role: "discovery" },
  { id: "optimism", label: "Optimism", role: "discovery" },
  { id: "polygon", label: "Polygon", role: "discovery" },
  { id: "linea", label: "Linea", role: "discovery" },
  { id: "avalanche", label: "Avalanche", role: "discovery" },
  { id: "celo", label: "Celo", role: "discovery" },
  { id: "zksync", label: "zkSync", role: "discovery" },
  { id: "megaeth", label: "MegaETH", role: "discovery" },
  { id: "solana", label: "Solana", role: "tokens only · 5k holders" },
] as const;

export function normalizePath(pathname: string) {
  return pathname.replace(/\/$/, "") || "/";
}

export function leafId(pathname: string): LeafId {
  const p = normalizePath(pathname);
  if (p.startsWith("/gates")) return "gates";
  if (p.startsWith("/evidence")) return "evidence";
  if (p.startsWith("/field")) return "field";
  if (p.startsWith("/hand")) return "hand";
  return "brief";
}

export function stepOf(pathname: string) {
  const p = normalizePath(pathname);
  if (p.startsWith("/gates")) return "/gates";
  if ((walk as readonly string[]).includes(p)) return p;
  return "/";
}

export function neighbors(pathname: string) {
  const i = (walk as readonly string[]).indexOf(stepOf(pathname) as (typeof walk)[number]);
  return {
    prev: i > 0 ? walk[i - 1] : null,
    next: i >= 0 && i < walk.length - 1 ? walk[i + 1] : null,
  };
}
