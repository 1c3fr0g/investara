import type { ListItem } from "./types";

export const INVESTMENT_FACTORS = [
  { key: "quality", label: "Profitabilitas", metrics: ["roe", "margin"] },
  { key: "value", label: "Valuasi", metrics: ["per", "pbv"] },
  { key: "growth", label: "Pertumbuhan", metrics: ["laba_growth", "pendapatan_growth"] },
  { key: "income", label: "Dividen", metrics: ["yield_pct"] },
] as const;

type FactorKey = (typeof INVESTMENT_FACTORS)[number]["key"];
type MetricKey = (typeof INVESTMENT_FACTORS)[number]["metrics"][number];

export const INVESTMENT_METRICS: Record<MetricKey, { label: string; lower: boolean; ratio: boolean }> = {
  roe: { label: "ROE", lower: false, ratio: false },
  margin: { label: "Margin laba", lower: false, ratio: false },
  per: { label: "PER", lower: true, ratio: true },
  pbv: { label: "PBV", lower: true, ratio: true },
  laba_growth: { label: "Pertumbuhan laba", lower: false, ratio: false },
  pendapatan_growth: { label: "Pertumbuhan pendapatan", lower: false, ratio: false },
  yield_pct: { label: "Yield dividen", lower: false, ratio: false },
};

export const INVESTMENT_PROFILES = [
  { id: "seimbang", label: "Seimbang", weights: { quality: 35, value: 30, growth: 25, income: 10 }, required: ["quality", "value"] },
  { id: "valuasi", label: "Valuasi", weights: { quality: 30, value: 50, growth: 20, income: 0 }, required: ["quality", "value"] },
  { id: "pertumbuhan", label: "Pertumbuhan", weights: { quality: 35, value: 15, growth: 50, income: 0 }, required: ["quality", "growth"] },
  { id: "dividen", label: "Dividen", weights: { quality: 35, value: 20, growth: 10, income: 35 }, required: ["quality", "income"] },
] as const satisfies readonly {
  id: string;
  label: string;
  weights: Record<FactorKey, number>;
  required: readonly FactorKey[];
}[];

export type InvestmentProfile = (typeof INVESTMENT_PROFILES)[number]["id"];
export const INVESTMENT_LIQUIDITY = [0, 1e9, 5e9, 20e9] as const;
export const MIN_INVESTMENT_COVERAGE = 60;
export const MIN_INVESTMENT_PEERS = 5;
export const INVESTMENT_PAGE_SIZE = 12;

export type InvestmentCandidate = Pick<ListItem, "kode" | "nama" | "sektor" | "harga" | "nilai" | "payout" | "der"> & {
  score: number;
  coverage: number;
  factors: {
    key: FactorKey;
    score: number | null;
    metrics: { key: MetricKey; value: number | null; median: number | null; peers: number; percentile: number | null }[];
  }[];
  flags: string[];
};

export type InvestmentResponse = {
  items: InvestmentCandidate[];
  total: number;
  considered: number;
  sectors: string[];
  page: number;
  pages: number;
  updatedAt: number;
};

const numberOrNull = (value: number | null) => value !== null && Number.isFinite(value) ? value : null;

function metricValue(stock: ListItem, key: MetricKey) {
  const value = numberOrNull(stock[key]);
  if (value === null || ((INVESTMENT_METRICS[key].ratio || key === "yield_pct") && value <= 0)) return null;
  return value;
}

function bound(values: number[], target: number, upper = false) {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (values[mid] < target || (upper && values[mid] === target)) left = mid + 1;
    else right = mid;
  }
  return left;
}

function getMetricComparison(stock: ListItem, key: MetricKey, values: number[]) {
  const value = metricValue(stock, key);
  const peers = values.length;
  if (peers < MIN_INVESTMENT_PEERS) return { key, value: numberOrNull(stock[key]), median: null, peers, percentile: null };
  const median = (values[Math.floor((peers - 1) / 2)] + values[Math.floor(peers / 2)]) / 2;
  if (value === null) return { key, value: numberOrNull(stock[key]), median, peers, percentile: null };
  const rank = (bound(values, value) + bound(values, value, true) - 1) / 2 / (peers - 1);
  return { key, value, median, peers, percentile: (INVESTMENT_METRICS[key].lower ? 1 - rank : rank) * 100 };
}

export function rankInvestments(items: ListItem[], profileId: InvestmentProfile, sector: string, minTrade: number) {
  const eligible = items.filter((item) => (numberOrNull(item.harga) ?? 0) > 0 &&
    item.papan !== "Pemantauan Khusus" && item.papan !== "Akselerasi");
  const sectors = [...new Set(eligible.flatMap(({ sektor }) => sektor ? [sektor] : []))].sort((a, b) => a.localeCompare(b, "id-ID"));
  const keys = INVESTMENT_FACTORS.flatMap(({ metrics }) => [...metrics]);
  const samples = new Map<string, Partial<Record<MetricKey, number[]>>>();
  for (const item of eligible) {
    if (!item.sektor) continue;
    const sample = samples.get(item.sektor) ?? {};
    samples.set(item.sektor, sample);
    for (const key of keys) {
      const value = metricValue(item, key);
      if (value !== null) (sample[key] ??= []).push(value);
    }
  }
  for (const sample of samples.values()) {
    for (const values of Object.values(sample)) values.sort((a, b) => a - b);
  }

  const profile = INVESTMENT_PROFILES.find(({ id }) => id === profileId) ?? INVESTMENT_PROFILES[0];
  const considered = eligible.filter((item) => (!sector || item.sektor === sector) &&
    (minTrade === 0 || (numberOrNull(item.nilai) ?? 0) >= minTrade));
  const ranked: InvestmentCandidate[] = [];
  for (const item of considered) {
    const sample = item.sektor ? samples.get(item.sektor) : undefined;
    if (!sample) continue;
    if (profile.id === "dividen" && !(item.payout !== null && item.payout > 0 && item.payout <= 100)) continue;

    let score = 0;
    let coverage = 0;
    const factors = INVESTMENT_FACTORS.flatMap(({ key, metrics }) => {
      const weight = profile.weights[key];
      if (!weight) return [];
      const comparisons = metrics.map((metric) => getMetricComparison(item, metric, sample[metric] ?? []));
      const scored = comparisons.flatMap(({ percentile }) => percentile === null ? [] : [percentile]);
      const observedMean = scored.length ? scored.reduce((sum, points) => sum + points, 0) / scored.length : null;
      const observedShare = scored.length / metrics.length;
      coverage += weight * observedShare;
      score += weight * ((observedMean ?? 50) * observedShare + 50 * (1 - observedShare)) / 100;
      return [{ key, score: observedMean, metrics: comparisons }];
    });
    if (coverage < MIN_INVESTMENT_COVERAGE || !profile.required.every((key) => factors.some((factor) => factor.key === key && factor.score !== null))) continue;
    const flags = [
      item.roe !== null && item.roe <= 0 ? "ROE tidak positif" : "",
      item.per !== null && item.per <= 0 ? "PER tidak positif" : "",
      item.laba_growth !== null && item.laba_growth < 0 ? "Laba menyusut" : "",
      item.payout !== null && item.payout > 100 ? "Payout di atas 100%" : "",
      item.sektor !== "Keuangan" && item.der !== null && item.der > 200 ? "DER di atas 200%" : "",
    ].filter(Boolean);
    const { kode, nama, sektor, harga, nilai, payout, der } = item;
    ranked.push({ kode, nama, sektor, harga, nilai, payout, der, score, coverage, factors, flags });
  }
  ranked.sort((a, b) => b.score - a.score || b.coverage - a.coverage || a.kode.localeCompare(b.kode));
  return { ranked, considered: considered.length, sectors };
}
