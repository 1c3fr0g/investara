import { NextResponse, type NextRequest } from "next/server";
import { getCryptoUniverse, getLiveFearAndGreed } from "@/lib/crypto";
import type { CryptoItem } from "@/lib/types";

const SORT_FIELDS = {
  mcap: "market_cap_usd",
  price: "price_usd",
  change_24h: "change_24h",
  change_7d: "change_7d",
  volume: "volume_24h_usd",
  rank: "rank",
} as const satisfies Record<string, keyof CryptoItem>;

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const q = (p.get("q") ?? "").trim().toLowerCase();
  const category = p.get("category");
  const symbols = p.get("symbols");
  const requested = symbols === null ? null : new Set(symbols.toUpperCase().split(",").slice(0, 100).filter((symbol) => /^[A-Z0-9]{1,20}$/.test(symbol)));
  const sort = p.get("sort") || "mcap";
  const field = Object.hasOwn(SORT_FIELDS, sort) ? SORT_FIELDS[sort as keyof typeof SORT_FIELDS] : "market_cap_usd";
  const dir = p.get("dir") === "asc" ? 1 : -1;
  const page = Math.max(1, parseInt(p.get("page") || "1", 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(p.get("size") || "20", 10) || 20));
  const force = p.get("refresh") === "1";

  try {
    const [{ items, updatedAt }, fearGreed] = await Promise.all([getCryptoUniverse(force), getLiveFearAndGreed()]);
    const filtered = items.filter((coin) =>
      (!requested || requested.has(coin.symbol))
      && (!q || coin.symbol.toLowerCase().includes(q) || coin.name.toLowerCase().includes(q))
      && (!category || category === "Semua" || coin.category === category),
    );
    filtered.sort((a, b) => {
      const x = a.stale ? null : a[field];
      const y = b.stale ? null : b[field];
      if (x === null || y === null) return Number(x === null) - Number(y === null);
      return (x - y) * dir;
    });

    const fresh = items.filter((coin) => !coin.stale);
    const caps = fresh.flatMap((coin) => coin.market_cap_usd === null ? [] : [coin.market_cap_usd]);
    const volumes = fresh.flatMap((coin) => coin.volume_24h_usd === null ? [] : [coin.volume_24h_usd]);
    const capTotal = caps.reduce((sum, value) => sum + value, 0);
    const btcCap = fresh.find((coin) => coin.symbol === "BTC")?.market_cap_usd;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / size));
    return NextResponse.json({
      items: filtered.slice((Math.min(page, pages) - 1) * size, Math.min(page, pages) * size),
      total,
      page: Math.min(page, pages),
      pages,
      updatedAt,
      availability: fresh.length ? "available" : items.length ? "stale" : "unavailable",
      stats: {
        totalMarketCapUsd: caps.length ? capTotal : null,
        totalVolume24hUsd: volumes.length ? volumes.reduce((sum, value) => sum + value, 0) : null,
        btcDominance: capTotal > 0 && btcCap != null ? (btcCap / capTotal) * 100 : null,
        marketCapCoverage: caps.length,
        volumeCoverage: volumes.length,
        fearGreed,
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal mengambil data kripto" }, { status: 502 });
  }
}
