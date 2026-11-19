import { NextResponse, type NextRequest } from "next/server";
import YahooFinance from "yahoo-finance2";
import { isKnownCode } from "@/lib/market";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type CandlePoint = {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartApiResponse = {
  kode: string;
  symbol: string;
  interval: string;
  regularMarketPrice: number | null;
  regularMarketTime: number | null;
  candles: CandlePoint[];
  updatedAt: number;
};

// In-memory cache for fast repeat requests
const chartCache = new Map<string, { at: number; data: ChartApiResponse }>();

export async function GET(req: NextRequest, ctx: RouteContext<"/api/saham/[kode]/chart">) {
  const { kode: raw } = await ctx.params;
  const kode = raw.toUpperCase().trim();
  if (!isKnownCode(kode)) {
    return NextResponse.json({ error: "Kode saham tidak dikenal" }, { status: 404 });
  }

  const searchParams = req.nextUrl.searchParams;
  const intervalParam = (searchParams.get("interval") || "5m").toLowerCase();
  const force = searchParams.get("refresh") === "1";

  // Map to Yahoo Finance supported intervals and appropriate period ranges
  let yfInterval: "1m" | "5m" | "15m" | "60m" | "1d" | "1wk" = "5m";
  let lookbackDays = 5;
  let cacheTtl = 5 * 1000; // 5 seconds for intraday

  switch (intervalParam) {
    case "1":
    case "1m":
      yfInterval = "1m";
      lookbackDays = 5;
      cacheTtl = 5 * 1000;
      break;
    case "5":
    case "5m":
      yfInterval = "5m";
      lookbackDays = 30;
      cacheTtl = 10 * 1000;
      break;
    case "15":
    case "15m":
      yfInterval = "15m";
      lookbackDays = 60;
      cacheTtl = 15 * 1000;
      break;
    case "60":
    case "60m":
    case "1h":
      yfInterval = "60m";
      lookbackDays = 180;
      cacheTtl = 30 * 1000;
      break;
    case "d":
    case "1d":
      yfInterval = "1d";
      lookbackDays = 730;
      cacheTtl = 60 * 1000;
      break;
    case "w":
    case "1w":
    case "1wk":
      yfInterval = "1wk";
      lookbackDays = 1825;
      cacheTtl = 300 * 1000;
      break;
    default:
      yfInterval = "5m";
      lookbackDays = 30;
      cacheTtl = 10 * 1000;
  }

  const cacheKey = `${kode}_${yfInterval}`;
  const now = Date.now();
  const hit = chartCache.get(cacheKey);

  if (!force && hit && now - hit.at < cacheTtl) {
    return NextResponse.json(hit.data);
  }

  const symbol = `${kode}.JK`;
  const period1 = new Date(now - lookbackDays * 24 * 3600 * 1000);

  try {
    const res = await yf.chart(symbol, {
      period1,
      interval: yfInterval,
    });

    const quotes = res.quotes || [];
    const candles: CandlePoint[] = [];

    for (const q of quotes) {
      if (
        typeof q.open === "number" &&
        typeof q.high === "number" &&
        typeof q.low === "number" &&
        typeof q.close === "number" &&
        q.date
      ) {
        candles.push({
          time: new Date(q.date).getTime(),
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
          volume: typeof q.volume === "number" ? q.volume : 0,
        });
      }
    }

    const responseData: ChartApiResponse = {
      kode,
      symbol,
      interval: yfInterval,
      regularMarketPrice: typeof res.meta?.regularMarketPrice === "number" ? res.meta.regularMarketPrice : null,
      regularMarketTime: typeof res.meta?.regularMarketTime === "number" ? res.meta.regularMarketTime * 1000 : null,
      candles,
      updatedAt: now,
    };

    chartCache.set(cacheKey, { at: now, data: responseData });
    return NextResponse.json(responseData);
  } catch (err) {
    if (hit) return NextResponse.json(hit.data);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengambil data chart" },
      { status: 502 }
    );
  }
}
