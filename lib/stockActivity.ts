import { MARKET_DAY_MS, marketDay } from "./marketDate";

export type BrokerActivity = {
  code: string;
  name: string;
  netValue: number;
  netShares: number;
  buyAverage: number | null;
  sellAverage: number | null;
};

export type InsiderReport = {
  published: string;
  document?: { number: string; url: string };
  name: string;
  role: string | null;
  purpose: string | null;
  before: number | null;
  after: number | null;
  beforePct: number | null;
  afterPct: number | null;
  transactions: { date: string | null; type: string; shares: number | null; price: number | null }[];
};

type Candle = { time: number; high: number; low: number; close: number; volume: number };

export function completedMoneyFlow(candles: Candle[], now = Date.now()) {
  const today = marketDay(now);
  const sessions = new Map<number, Candle>();
  for (const candle of candles) {
    const { time, high, low, close, volume } = candle;
    if (![time, high, low, close, volume].every(Number.isFinite) || time < 0 || time > now ||
        low <= 0 || close < low || close > high || volume < 0) continue;
    const day = marketDay(time);
    const current = sessions.get(day);
    if (day < today && (!current || current.time <= time)) sessions.set(day, candle);
  }
  const window = [...sessions.entries()].sort(([a], [b]) => a - b).slice(-20);
  if (window.length < 20) return null;
  let weighted = 0;
  let total = 0;
  for (const [, { high, low, close, volume }] of window) {
    const multiplier = high === low ? 0 : ((close - low) - (high - close)) / (high - low);
    weighted += multiplier * volume;
    total += volume;
  }
  if (total <= 0) return null;
  return { value: weighted / total, date: dateOnly(window[window.length - 1][0]) };
}

function dateOnly(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function activityPeriod(days: number, now = Date.now()) {
  const today = marketDay(now);
  return { from: dateOnly(today - (days - 1) * MARKET_DAY_MS), to: dateOnly(today) };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function numeric(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d+(\.\d+)?$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER ? number : null;
}

function nonnegative(value: unknown) {
  const n = numeric(value);
  return n !== null && n >= 0 ? n : null;
}

export function providerDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;
  const date = value.slice(0, 10);
  const timestamp = Date.parse(date + "T00:00:00Z");
  return Number.isFinite(timestamp) && dateOnly(timestamp) === date ? date : null;
}

export function parseBrokerActivity(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Respons ringkasan broker tidak valid");
  const seen = new Set<string>();
  const rows: BrokerActivity[] = [];
  for (const entry of value) {
    const row = object(entry);
    const code = typeof row?.code === "string" ? row.code.trim().toUpperCase() : "";
    const buyValue = nonnegative(row?.buy_value);
    const sellValue = nonnegative(row?.sell_value);
    const buyShares = nonnegative(row?.buy_volume);
    const sellShares = nonnegative(row?.sell_volume);
    if (!/^[A-Z]{2}$/.test(code) || seen.has(code) || buyValue === null || sellValue === null || buyShares === null || sellShares === null) {
      throw new Error("Baris ringkasan broker tidak valid");
    }
    seen.add(code);
    rows.push({
      code,
      name: typeof row?.name === "string" ? row.name.trim() || code : code,
      netValue: buyValue - sellValue,
      netShares: buyShares - sellShares,
      buyAverage: buyShares > 0 ? buyValue / buyShares : null,
      sellAverage: sellShares > 0 ? sellValue / sellShares : null,
    });
  }
  return {
    buyers: rows.filter((row) => row.netValue > 0).sort((a, b) => b.netValue - a.netValue).slice(0, 5),
    sellers: rows.filter((row) => row.netValue < 0).sort((a, b) => a.netValue - b.netValue).slice(0, 5),
    count: rows.length,
  };
}

export function parseInsiderReports(value: unknown, code: string, page: number) {
  const response = object(value);
  if (!response || !Array.isArray(response.data) || response.page !== page ||
      (response.nextPage !== null && response.nextPage !== page + 1)) {
    throw new Error("Respons laporan insider tidak valid");
  }
  const reports: InsiderReport[] = [];
  for (const entry of response.data) {
    const raw = object(entry);
    if (typeof raw?.code !== "string" || raw.code.toUpperCase() !== code) continue;
    const published = providerDate(raw.date);
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!published || !name || !Array.isArray(raw.subrow)) throw new Error("Laporan insider tidak valid");
    const transactions = raw.subrow.map((entry) => {
      const row = object(entry);
      const type = typeof row?.status === "string" ? row.status.trim() : "";
      return {
        date: providerDate(row?.date), type: type || "Jenis belum tersedia",
        shares: nonnegative(row?.value), price: nonnegative(row?.price),
      };
    });
    reports.push({
      published, name, role: typeof raw.badge === "string" ? raw.badge.replace(/[{}]/g, "").split(",").map((role) => role.trim()).filter(Boolean).join(", ") || null : null,
      purpose: typeof raw.purpose === "string" ? raw.purpose.trim() || null : null,
      before: nonnegative(raw.prev_val), after: nonnegative(raw.next_val),
      beforePct: nonnegative(raw.prev_percent), afterPct: nonnegative(raw.next_percent), transactions,
    });
  }
  return { reports, nextPage: response.nextPage };
}
