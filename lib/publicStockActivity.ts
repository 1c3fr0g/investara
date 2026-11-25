import { providerDate, type InsiderReport } from "./stockActivity";

type Period = { from: string; to: string };

export type GrossBroker = { code: string; name: string | null; lots: number; value: number; average: number | null };
export type ForeignSnapshot = { date: string; netValue: number; stale: boolean };

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function grossBrokers(rows: unknown): GrossBroker[] {
  if (!Array.isArray(rows)) throw new Error("Daftar broker IPOT tidak valid");
  return rows.slice(0, 5).map((value) => {
    const row = record(value);
    if (typeof row?.code !== "string" || !/^[A-Z]{2}$/.test(row.code) ||
        !finite(row.lots) || row.lots <= 0 || !finite(row.value) || row.value < 0) {
      throw new Error("Baris broker IPOT tidak valid");
    }
    return {
      code: row.code, name: typeof row.name === "string" ? row.name : null,
      lots: row.lots, value: row.value,
      average: finite(row.average_price) && row.average_price > 0 ? row.average_price : null,
    };
  });
}

export function parsePublicBrokers(input: unknown, kode: string, period: Period) {
  const envelope = record(input);
  const row = Array.isArray(envelope?.data) ? envelope.data.map(record).find((item) => item?.symbol === kode) : undefined;
  if (envelope?.schema !== "idx.broker.v1" || !row || row.from !== period.from || row.to !== period.to ||
      row.investor !== "all" || row.board !== "regular" || (row.source ?? envelope.provider) !== "ipot") {
    throw new Error("Periode atau sumber ringkasan broker tidak cocok");
  }
  return { buyers: grossBrokers(row.buyers), sellers: grossBrokers(row.sellers), stale: envelope.stale === true };
}

export function parseForeignSnapshot(input: unknown, kode: string, today: string): ForeignSnapshot | null {
  const envelope = record(input);
  const data = record(envelope?.data);
  const date = providerDate(data?.date);
  if (envelope?.schema !== "idx.market.foreign.value.v1" || envelope.provider !== "ipot" || !data || !date || date > today ||
      !Array.isArray(data.net_buy) || !Array.isArray(data.net_sell)) return null;
  const entry = [...data.net_buy, ...data.net_sell].map(record).find((row) => row?.symbol === kode);
  return finite(entry?.foreign_net_value) ? { date, netValue: entry.foreign_net_value, stale: envelope.stale === true } : null;
}

const officialReports: Record<string, InsiderReport[]> = {
  ANTM: [{
    published: "2026-11-18", name: "Arini Kasmira", role: "Direksi", purpose: "Pembelian",
    before: 244_000, after: 284_000, beforePct: null, afterPct: null,
    transactions: [{ date: "2026-11-16", type: "Buy", shares: 40_000, price: 2_720 }],
    document: {
      number: "LK/18112026/0023/1",
      url: "https://www.idx.co.id/StaticData/NewsAndAnnouncement/ANNOUNCEMENTSTOCK/From_KSEI/LK-18112026-6001-00.pdf-0.pdf",
    },
  }],
};

export function getCuratedReports(kode: string, period: Period, page: number) {
  if (page !== 1) return [];
  return (officialReports[kode] ?? []).filter(({ published }) => published >= period.from && published <= period.to);
}
