import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const OPTS = { validateResult: false } as const;
let cache: { at: number; body: unknown } | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < 60_000) return NextResponse.json(cache.body);
    const now = Date.now();
    const [q, c] = await Promise.all([
      yf.quote("^JKSE", {}, OPTS),
      yf.chart("^JKSE", { period1: new Date(now - 45 * 24 * 3600 * 1000), period2: new Date(now), interval: "1d" }, OPTS),
    ]);
    const quote = q as unknown as {
      regularMarketPrice?: number;
      regularMarketChange?: number;
      regularMarketChangePercent?: number;
      regularMarketTime?: Date | number;
    };
    const seri = ((c as unknown as { quotes?: { close?: number | null }[] }).quotes ?? [])
      .map((x) => x.close)
      .filter((v): v is number => typeof v === "number");
    const body = {
      harga: quote.regularMarketPrice ?? null,
      perubahan: quote.regularMarketChange ?? null,
      perubahan_pct: quote.regularMarketChangePercent ?? null,
      waktu: quote.regularMarketTime ? new Date(quote.regularMarketTime).getTime() : null,
      seri,
      updatedAt: now,
    };
    cache = { at: now, body };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 502 });
  }
}
