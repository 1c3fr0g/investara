import { NextResponse, type NextRequest } from "next/server";
import YahooFinance from "yahoo-finance2";
import { isKnownCode } from "@/lib/market";
import type { LaporanResponse, LaporanRow } from "@/lib/types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const TTL = 6 * 3600 * 1000;
const cache = new Map<string, { at: number; data: LaporanResponse }>();

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

async function fetchRows(symbol: string, type: "annual" | "quarterly", years: number): Promise<LaporanRow[]> {
  const raw = (await yf
    .fundamentalsTimeSeries(symbol, { period1: new Date(Date.now() - years * 365 * 864e5), type, module: "all" }, { validateResult: false })
    .catch(() => [])) as unknown as Record<string, unknown>[];
  return raw
    .map((r) => ({
      tanggal: new Date(r.date as string | number | Date).toISOString().slice(0, 10),
      pendapatan: n(r.totalRevenue) ?? n(r.operatingRevenue),
      laba: n(r.netIncomeCommonStockholders) ?? n(r.netIncome),
      aset: n(r.totalAssets),
      ekuitas: n(r.stockholdersEquity) ?? n(r.commonStockEquity),
      utang: n(r.totalDebt),
      arus_kas_operasi: n(r.operatingCashFlow),
      fcf: n(r.freeCashFlow),
      eps: n(r.basicEPS),
    }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/saham/[kode]/laporan">) {
  const { kode: raw } = await ctx.params;
  const kode = raw.toUpperCase();
  if (!isKnownCode(kode)) return NextResponse.json({ error: "Kode saham tidak dikenal" }, { status: 404 });
  const hit = cache.get(kode);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);
  try {
    const [tahunan, kuartalan] = await Promise.all([
      fetchRows(`${kode}.JK`, "annual", 8),
      fetchRows(`${kode}.JK`, "quarterly", 3),
    ]);
    const data: LaporanResponse = { tahunan, kuartalan };
    if (tahunan.length || kuartalan.length) cache.set(kode, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengambil laporan" }, { status: 502 });
  }
}
