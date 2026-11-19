import { GROUPS, MSCI_STANDARD, MSCI_SMALLCAP } from "./groups";
import type { ListItem } from "./types";

export const FILTER_DEFS = [
  { key: "yield_pct", label: "Yield dividen (%)" },
  { key: "payout", label: "Payout ratio (%)" },
  { key: "per", label: "PER (x)" },
  { key: "pbv", label: "PBV (x)" },
  { key: "roe", label: "ROE (%)" },
  { key: "margin", label: "Margin laba bersih (%)" },
  { key: "der", label: "Debt/Equity (%)" },
  { key: "laba_growth", label: "Pertumbuhan laba (%)" },
  { key: "pendapatan_growth", label: "Pertumbuhan omzet (%)" },
  { key: "mcap", label: "Market cap (Rp miliar)" },
] as const;

export const FILTER_PARAMS = FILTER_DEFS.flatMap((f) => [`min_${f.key}`, `max_${f.key}`]);
export const SAVED_QUERY_PARAMS = [...FILTER_PARAMS, "grup", "q", "sort", "dir", "super", "msciOnly"];

export function savedScreenerQuery(raw: string): URLSearchParams {
  const input = new URLSearchParams(raw);
  const query = new URLSearchParams();
  for (const { key } of FILTER_DEFS) {
    const [min, max] = ["min_", "max_"].map((prefix) => {
      const value = input.get(prefix + key)?.trim();
      if (!value) return null;
      const number = Number(value);
      const unit = key === "mcap" ? 1e9 : 1;
      if (!Number.isFinite(number * unit)) throw new Error("Masukkan angka yang valid.");
      query.set(prefix + key, String(number));
      return number;
    });
    if (min !== null && max !== null && min > max) throw new Error("Batas minimum harus di bawah atau sama dengan maksimum.");
  }
  const group = input.get("grup") ?? "";
  if (group !== "semua" && (group === "watchlist" || GROUPS.some(({ id }) => id === group) || /^sek:[^\u0000-\u001f]{1,80}$/.test(group))) {
    query.set("grup", group);
  }
  const search = input.get("q")?.trim().slice(0, 40);
  if (search) query.set("q", search);
  if (group === "swing") {
    for (const key of ["super", "msciOnly"]) {
      if (input.get(key) === "1") query.set(key, "1");
    }
  }
  if (!query.size) throw new Error("Tambahkan pencarian, kelompok saham, atau kriteria filter.");
  const sort = input.get("sort") as SortKey | null;
  if (sort && SORTS.includes(sort)) query.set("sort", sort);
  if (input.get("dir") === "asc") query.set("dir", "asc");
  return query;
}

export const SORTS = ["mcap", "harga", "perubahan_pct", "per", "pbv", "yield_pct", "volume", "nilai", "kode", "roe", "payout", "der", "margin", "laba_growth", "foreign_flow", "swing_prob"] as const;
export type SortKey = (typeof SORTS)[number];

const MSCI_STANDARD_SET = new Set(MSCI_STANDARD);
const MSCI_SMALLCAP_SET = new Set(MSCI_SMALLCAP);

function calculateSwingProbability(item: ListItem): number {
  let score = 45; // baseline

  const isMsciStandard = MSCI_STANDARD_SET.has(item.kode);
  const isMsciSmallCap = MSCI_SMALLCAP_SET.has(item.kode);

  // 1. Foreign Flow & Bandarmologi (Max +25)
  if (item.foreign_status === "Akumulasi Masif") score += 25;
  else if (item.foreign_status === "Akumulasi" || (item.foreign_flow ?? 0) > 3_000_000_000) score += 20;
  else if ((item.foreign_flow ?? 0) > 0 || (item.cmf ?? 0) > 0.04) score += 14;
  else if (item.foreign_status === "Distribusi Masif") score -= 20;
  else if (item.foreign_status === "Distribusi") score -= 10;

  // 2. Institutional Backing (MSCI Index) (Max +15)
  if (isMsciStandard) score += 15;
  else if (isMsciSmallCap) score += 10;

  // 3. Sweet Spot Price Action (-1.5% to +2.5%) (Max +20)
  const change = item.perubahan_pct ?? 0;
  if (change >= -0.8 && change <= 1.5) score += 20; // Ideal springboard
  else if (change > 1.5 && change <= 2.8) score += 15; // Solid momentum
  else if (change >= -2.2 && change < -0.8) score += 12; // Controlled pullback
  else if (change > 2.8) score += 5; // Risk of chasing peak
  else if (change < -2.2) score -= 10; // Selling pressure

  // 4. Liquidity & Turnover (Max +15)
  const turnover = item.nilai ?? 0;
  if (turnover >= 25_000_000_000) score += 15;
  else if (turnover >= 15_000_000_000) score += 12;
  else if (turnover >= 10_000_000_000) score += 8;

  // 5. Fundamentals & Solvency (Max +15)
  if ((item.roe ?? 0) >= 12 && (item.der ?? 999) <= 150) score += 15;
  else if ((item.roe ?? 0) >= 8) score += 10;
  else if ((item.roe ?? 0) > 0) score += 5;
  if ((item.der ?? 0) > 250) score -= 8;

  return Math.max(55, Math.min(92, Math.round(score)));
}

export function screenStocks(items: ListItem[], p: URLSearchParams, watchlist?: readonly string[]): ListItem[] {
  const q = (p.get("q") ?? "").trim().toLowerCase().slice(0, 40);
  const kodes = watchlist ? new Set(watchlist) : p.get("kodes") ? new Set(p.get("kodes")!.toUpperCase().split(",").slice(0, 300)) : null;
  const ranges = FILTER_DEFS.flatMap(({ key: f }) => {
    const unit = f === "mcap" ? 1e9 : 1;
    const lo = p.get(`min_${f}`);
    const hi = p.get(`max_${f}`);
    const min = lo !== null && lo !== "" && Number.isFinite(Number(lo)) ? Number(lo) * unit : null;
    const max = hi !== null && hi !== "" && Number.isFinite(Number(hi)) ? Number(hi) * unit : null;
    return min === null && max === null ? [] : [{ f, min, max }];
  });

  const group = GROUPS.find((g) => g.id === p.get("grup"));
  const sektorParam = p.get("grup")?.startsWith("sek:") ? p.get("grup")!.slice(4) : null;
  const codes = group?.codes ? new Set(group.codes) : null;
  let list: ListItem[] = items.filter(
    (i) =>
      (!kodes || kodes.has(i.kode)) &&
      (!codes || codes.has(i.kode)) &&
      (!group?.papan || i.papan === group.papan) &&
      (!sektorParam || i.sektor === sektorParam) &&
      (!q || i.kode.toLowerCase().includes(q) || i.nama.toLowerCase().includes(q)) &&
      ranges.every(({ f, min, max }) => {
        const v = i[f];
        return v !== null && (min === null || v >= min) && (max === null || v <= max);
      }),
  );

  // Strict High-Conviction Validation for 1-3% Swing Trading
  if (p.get("grup") === "swing") {
    const isSuperOnly = p.get("super") === "1";

    list = list
      .map((i) => {
        const prob = calculateSwingProbability(i);
        const isNotFca = i.papan !== "Pemantauan Khusus" && i.papan !== "Akselerasi";
        const isPriceValid = (i.harga ?? 0) >= 200 && (i.volume ?? 0) > 0;
        const isMsci = MSCI_STANDARD_SET.has(i.kode) || MSCI_SMALLCAP_SET.has(i.kode);
        const turnover = i.nilai ?? 0;
        const chg = i.perubahan_pct ?? 0;
        const der = i.der ?? 0;
        const roe = i.roe ?? 0;
        const flow = i.foreign_flow ?? 0;
        const status = i.foreign_status;

        // 💎 1. ULTRA-HIGH CONVICTION SUPER PICKS (Target Win Rate >= 90%):
        const isUltraLiquid = turnover >= 20_000_000_000;
        const inSpringboard = chg >= -1.2 && chg <= 1.5;
        const isSound = der <= 250 && roe >= 6;
        const hasPureForeignBuy =
          flow > 0 || status === "Akumulasi Masif" || status === "Akumulasi";
        const isSuperScore = prob >= 88;

        const isSuper =
          isNotFca &&
          isPriceValid &&
          isUltraLiquid &&
          inSpringboard &&
          isSound &&
          isMsci &&
          hasPureForeignBuy &&
          isSuperScore;

        // ⚡ 2. TIGHTENED HIGH-CONVICTION PICKS (Target Win Rate >= 78%-85%):
        // - Likuiditas tebal: Turnover >= 10M atau Mcap >= 15T
        const isLiquid = turnover >= 10_000_000_000 || ((i.mcap ?? 0) >= 15e12 && (i.volume ?? 0) >= 80_000);
        // - Zona konsolidasi ketat (-1.5% s/d +2.2%): tidak kejar pucuk & bukan pisau jatuh
        const inTightRange = chg >= -1.5 && chg <= 2.2;
        // - Solvabilitas teruji: DER <= 250% & ROE >= 4% (wajib laba positif)
        const isSolvent = der <= 250 && roe >= 4;
        // - Zero foreign distribution: DILARANG KERAS ada aksi jual masif asing
        const noForeignSell =
          status !== "Distribusi Masif" &&
          status !== "Distribusi" &&
          flow >= 0;
        // - Skor konvinsi minimal 78% (membuang saham spekulatif 65%)
        const isHighProb = prob >= 78;
        // - Kualitas institusional: MSCI atau Big Cap Liquid
        const isQuality = isMsci || (i.mcap ?? 0) >= 15e12;

        const isHighConviction =
          !isSuper &&
          isNotFca &&
          isPriceValid &&
          isLiquid &&
          inTightRange &&
          isSolvent &&
          noForeignSell &&
          isHighProb &&
          isQuality;

        let tier: "SUPER" | "HIGH_CONVICTION" | null = null;
        if (isSuper) tier = "SUPER";
        else if (isHighConviction) tier = "HIGH_CONVICTION";

        return { ...i, swing_prob: prob, swing_tier: tier };
      })
      .filter((i) => {
        if (isSuperOnly) {
          return i.swing_tier === "SUPER";
        }
        // Combined view: both Super Picks and Tightened High Conviction Picks
        return i.swing_tier === "SUPER" || i.swing_tier === "HIGH_CONVICTION";
      });
  }

  if (p.get("grup") === "swing" && p.get("super") !== "1" && p.get("msciOnly") === "1") {
    list = list.filter((item) => MSCI_STANDARD_SET.has(item.kode) || MSCI_SMALLCAP_SET.has(item.kode));
  }
  return list;
}
