"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CryptoCategory, CryptoFearGreed, CryptoItem } from "@/lib/types";
import { Card } from "./ui";
import { CoinIcon } from "./CoinIcon";
import { PriceFlash } from "./PriceFlash";

interface CryptoApiResponse {
  items: CryptoItem[];
  total: number;
  updatedAt: number | null;
  stats: {
    totalMarketCapUsd: number | null;
    totalVolume24hUsd: number | null;
    btcDominance: number | null;
    fearGreed: CryptoFearGreed;
  };
}

const CATEGORY_ORDER: CryptoCategory[] = [
  "Layer 1",
  "Layer 2",
  "DeFi",
  "AI & Big Data",
  "Meme",
  "Infrastructure",
  "Payments",
  "Interoperability",
  "Stablecoin",
  "Lainnya",
];

function getChangeColor(pct: number): {
  bg: string;
  border: string;
  badge: string;
  text: string;
} {
  if (pct >= 5) {
    return {
      bg: "bg-emerald-600 dark:bg-emerald-600/90",
      border: "border-emerald-400/60 dark:border-emerald-400/40",
      badge: "bg-emerald-700/70 text-emerald-100",
      text: "text-white",
    };
  }
  if (pct >= 2) {
    return {
      bg: "bg-emerald-500 dark:bg-emerald-500/85",
      border: "border-emerald-300/50 dark:border-emerald-300/30",
      badge: "bg-emerald-600/70 text-emerald-100",
      text: "text-white",
    };
  }
  if (pct >= 0) {
    return {
      bg: "bg-teal-600/90 dark:bg-teal-600/80",
      border: "border-teal-300/40 dark:border-teal-300/20",
      badge: "bg-teal-700/70 text-teal-100",
      text: "text-white",
    };
  }
  if (pct >= -2) {
    return {
      bg: "bg-rose-500/85 dark:bg-rose-500/80",
      border: "border-rose-300/40 dark:border-rose-300/25",
      badge: "bg-rose-700/70 text-rose-100",
      text: "text-white",
    };
  }
  if (pct >= -5) {
    return {
      bg: "bg-rose-600 dark:bg-rose-600/90",
      border: "border-rose-400/50 dark:border-rose-400/30",
      badge: "bg-rose-700/80 text-rose-100",
      text: "text-white",
    };
  }
  return {
    bg: "bg-rose-700 dark:bg-rose-800/95",
    border: "border-rose-500/60 dark:border-rose-500/40",
    badge: "bg-rose-900/80 text-rose-100",
    text: "text-white",
  };
}

export function CryptoHeatmap() {
  const [data, setData] = useState<CryptoApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState<"IDR" | "USD">("IDR");
  const [viewMode, setViewMode] = useState<"category" | "all">("category");
  const [search, setSearch] = useState("");
  const [hoveredCoin, setHoveredCoin] = useState<CryptoItem | null>(null);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  const fetchData = async (force = false, isBackground = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (force) setRefreshing(true);
    if (!isBackground && !data) setLoading(true);
    try {
      const q = new URLSearchParams({
        size: "100",
        sort: "mcap",
        dir: "desc",
        ...(force ? { refresh: "1" } : {}),
      });
      const res = await fetch(`/api/crypto?${q}`);
      if (!res.ok) throw new Error("Gagal mengambil data crypto");
      const json: CryptoApiResponse = await res.json();
      setData(json);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchData(false, true);
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (usd: number, idr: number) => {
    if (currency === "USD") {
      if (usd >= 1) return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
    }
    if (idr >= 1000) return `Rp ${Math.round(idr).toLocaleString("id-ID")}`;
    return `Rp ${idr.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  };

  const formatBigNum = (usd: number | null, idr: number | null) => {
    if (usd === null || idr === null) return "?";
    if (currency === "USD") {
      if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)} T`;
      if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)} B`;
      if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)} M`;
      return `$${usd.toLocaleString("en-US")}`;
    }
    if (idr >= 1e15) return `Rp ${(idr / 1e15).toFixed(2)} Qd`;
    if (idr >= 1e12) return `Rp ${(idr / 1e12).toFixed(2)} T`;
    if (idr >= 1e9) return `Rp ${(idr / 1e9).toFixed(2)} M`;
    return `Rp ${Math.round(idr).toLocaleString("id-ID")}`;
  };

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    const available = data.items.filter((item) => !item.stale && item.change_24h !== null);
    if (!search.trim()) return available;
    const q = search.toLowerCase().trim();
    return available.filter(
      (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [data?.items, search]);

  // Group by category
  const categorized = useMemo(() => {
    const map = new Map<CryptoCategory, CryptoItem[]>();
    for (const item of filteredItems) {
      const cat = item.category || "Layer 1";
      const existing = map.get(cat) ?? [];
      existing.push(item);
      map.set(cat, existing);
    }
    return CATEGORY_ORDER.filter((cat) => map.has(cat) && (map.get(cat)?.length ?? 0) > 0).map(
      (cat) => ({
        category: cat,
        items: map.get(cat)!,
        totalCapUsd: map.get(cat)!.reduce((acc, c) => acc + (c.market_cap_usd ?? 0), 0),
        avgChange:
          map.get(cat)!.reduce(
            (acc, c) => acc + (c.change_24h ?? 0),
            0
          ) / (map.get(cat)!.length || 1),
      })
    );
  }, [filteredItems]);

  // Breadth calculation (Gainers vs Losers)
  const breadth = useMemo(() => {
    const usable = (data?.items ?? []).filter((coin) => !coin.stale && coin.change_24h !== null);
    const gainers = usable.filter((coin) => (coin.change_24h ?? 0) > 0).length;
    const losers = usable.filter((coin) => (coin.change_24h ?? 0) < 0).length;
    const total = gainers + losers;
    return { gainers, losers, ratio: total ? gainers / total * 100 : null };
  }, [data?.items]);

  // Dynamic Fear & Greed pill color
  const fgColor = useMemo(() => {
    const score = data?.stats.fearGreed.value ?? -1;
    if (score < 0) return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    if (score >= 75) return "bg-emerald-500 text-white";
    if (score >= 55) return "bg-teal-500 text-white";
    if (score >= 45) return "bg-amber-500 text-zinc-950 font-bold";
    if (score >= 25) return "bg-orange-500 text-white";
    return "bg-rose-600 text-white";
  }, [data?.stats.fearGreed.value]);

  return (
    <main className="screen-shell screen-section space-y-6">
      {/* ── Top Header Bar (Apple Crystal Clear Glass) ────────────────────────── */}
      <div className="crystal-intro flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="crystal-title">
              Peta Panas Kripto (Heatmap)
            </h1>

          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Warna menunjukkan perubahan harga dari penyedia. Peringkat kapitalisasi memakai data Yahoo Finance yang tersedia.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/crypto/bandingkan"
            className="flex items-center gap-1.5 rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-2 text-xs font-semibold text-zinc-800 shadow-xs backdrop-blur-xl transition hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:bg-[#141821]/80 dark:text-zinc-200 dark:hover:text-emerald-300"
          >
            <span>⚖️</span>
            <span>Bandingkan Kripto →</span>
          </Link>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-700/20 transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
          >
            <span className={refreshing ? "animate-spin" : ""}>↻</span>
            <span>{refreshing ? "Memuat..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ── Key Market Stats Glass Panel ─────────────────────────────────────── */}
      {data?.stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          <Card className="p-4 sm:p-5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Kapitalisasi Terpantau
            </span>
            <span className="mt-1 block text-lg sm:text-xl font-extrabold tabular-nums text-zinc-950 dark:text-zinc-100">
              {formatBigNum(data.stats.totalMarketCapUsd, data.stats.totalMarketCapUsd === null ? null : data.stats.totalMarketCapUsd * 15850)}
            </span>
            <span className="mt-0.5 block text-[11px] text-zinc-400">Data tersedia dari Yahoo Finance</span>
          </Card>

          <Card className="p-4 sm:p-5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Volume 24 Jam
            </span>
            <span className="mt-1 block text-lg sm:text-xl font-extrabold tabular-nums text-zinc-950 dark:text-zinc-100">
              {formatBigNum(data.stats.totalVolume24hUsd, data.stats.totalVolume24hUsd === null ? null : data.stats.totalVolume24hUsd * 15850)}
            </span>
            <span className="mt-0.5 block text-[11px] text-zinc-400">Aset terpantau di Binance Spot</span>
          </Card>

          <Card className="p-4 sm:p-5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Dominansi Bitcoin
            </span>
            <span className="mt-1 block text-lg sm:text-xl font-extrabold tabular-nums text-amber-500 dark:text-amber-400">
              {data.stats.btcDominance}%
            </span>
            <span className="mt-0.5 block text-[11px] text-zinc-400">Pangsa pasar BTC</span>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Fear &amp; Greed
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${fgColor}`}>
                {data.stats.fearGreed.value ?? "?"}
              </span>
            </div>
            <span className="mt-1 block text-lg sm:text-xl font-extrabold text-zinc-950 dark:text-zinc-100">
              {data.stats.fearGreed.sentiment}
            </span>
            <span className="mt-0.5 block text-[11px] text-zinc-400">Sentimen pasar kripto</span>
          </Card>
        </div>
      )}

      {/* ── Filter & Segmented Controls Bar ──────────────────────────────────── */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* View Mode Segmented Control */}
          <div className="flex items-center gap-1 rounded-2xl border border-zinc-200/80 bg-zinc-100/80 p-1 dark:border-white/10 dark:bg-zinc-800/60">
            <button
              onClick={() => setViewMode("category")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                viewMode === "category"
                  ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              🏷️ Berdasarkan Kategori
            </button>
            <button
              onClick={() => setViewMode("all")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                viewMode === "all"
                  ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              🌐 Top 50 Keseluruhan
            </button>
          </div>

          {/* Currency Toggle (IDR vs USD) */}
          <div className="flex items-center gap-1 rounded-2xl border border-zinc-200/80 bg-zinc-100/80 p-1 dark:border-white/10 dark:bg-zinc-800/60">
            <button
              onClick={() => setCurrency("IDR")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                currency === "IDR"
                  ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              🇮🇩 IDR (Rp)
            </button>
            <button
              onClick={() => setCurrency("USD")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                currency === "USD"
                  ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              🇺🇸 USD ($)
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari simbol atau koin..."
              className="w-full rounded-xl border border-zinc-200/90 bg-white/90 px-3.5 py-1.5 text-xs outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/50 dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-100 dark:focus:ring-emerald-900/40"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Market Breadth Gauge Bar */}
        <div className="pt-1">
          <div className="flex items-center justify-between text-xs font-semibold pb-1.5">
            <span className="text-emerald-600 dark:text-emerald-400">
              ▲ {breadth.gainers} Koin Naik {breadth.ratio !== null && "(" + breadth.ratio.toFixed(0) + "%)"}
            </span>
            <span className="text-zinc-400 text-[11px]">
              Intensitas pasar 24 jam
            </span>
            <span className="text-rose-600 dark:text-rose-400">
              ▼ {breadth.losers} Koin Turun {breadth.ratio !== null && "(" + (100 - breadth.ratio).toFixed(0) + "%)"}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${breadth.ratio ?? 0}%` }}
            />
          </div>
        </div>
      </Card>

      {/* ── Loading Spinner State ────────────────────────────────────────────── */}
      {failed && (
        <Card className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <p role="alert">{data ? "Pembaruan gagal. Peta menunjukkan data terakhir." : "Peta panas kripto gagal dimuat."}</p>
          <button type="button" disabled={refreshing} onClick={() => void fetchData(true)}
            className="control-button ios-glass-pill rounded-xl font-semibold">Coba lagi</button>
        </Card>
      )}
      {data && !loading && filteredItems.length === 0 && (
        <Card className="p-5 text-sm"><p role="status">
          {search.trim() ? "Koin yang cocok dengan pencarian belum tersedia." : "Perubahan harga kripto belum tersedia."}
        </p></Card>
      )}
      {loading && !data && (
        <Card className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-500 dark:border-zinc-800 dark:border-t-emerald-400" />
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Memuat peta pasar kripto live...
          </p>
          <p className="mt-1 text-xs text-zinc-400">Sinkronisasi harga dan kapitalisasi pasar Binance Spot</p>
        </Card>
      )}

      {/* ── HEATMAP TILES SECTION ────────────────────────────────────────────── */}
      {data && viewMode === "category" && (
        <div className="space-y-6">
          {categorized.map((group) => {
            const up = group.avgChange >= 0;
            return (
              <Card key={group.category} className="p-5 sm:p-6 space-y-4">
                {/* Category Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                    <h2 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-zinc-100">
                      {group.category}
                    </h2>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {group.items.length} Aset
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-zinc-400">
                      Total Cap:{" "}
                      <strong className="text-zinc-800 dark:text-zinc-200">
                        {group.totalCapUsd > 0 ? formatBigNum(group.totalCapUsd, group.totalCapUsd * 15850) : "—"}
                      </strong>
                    </span>
                    <span
                      className={`font-bold tabular-nums ${
                        up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      Rata-rata: {up ? "▲ +" : "▼ "}
                      {group.avgChange.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Squarified Grid Tiles for this Category */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 auto-rows-fr">
                  {group.items.map((coin, index) => {
                    const change = coin.change_24h ?? 0;
                    const style = getChangeColor(change);
                    const isHero = index === 0 && (coin.market_cap_usd ?? 0) > 10_000_000_000;

                    return (
                      <Link
                        key={coin.symbol}
                        href={`/crypto/${coin.symbol}`}
                        onMouseEnter={() => setHoveredCoin(coin)}
                        onMouseLeave={() => setHoveredCoin(null)}
                        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 shadow-sm transition-all duration-200 hover:scale-[1.03] hover:shadow-lg hover:z-20 ${
                          style.bg
                        } ${style.border} ${style.text} ${
                          isHero ? "col-span-2 row-span-2 sm:col-span-2 sm:row-span-2 p-5" : ""
                        }`}
                      >
                        {/* Top Row: Icon + Symbol + Rank */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CoinIcon
                              symbol={coin.symbol}
                              name={coin.name}
                              className={isHero ? "h-9 w-9" : "h-7 w-7"}
                              size={isHero ? 36 : 28}
                            />
                            <div>
                              <div className={`font-black tracking-tight ${isHero ? "text-lg" : "text-sm"}`}>
                                {coin.symbol}
                              </div>
                              <div className="text-[10px] opacity-80 truncate max-w-[80px] sm:max-w-[100px]">
                                {coin.name}
                              </div>
                            </div>
                          </div>

                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${style.badge}`}>
                            #{coin.rank}
                          </span>
                        </div>

                        {/* Middle/Bottom: Price & Change */}
                        <div className="mt-3 space-y-0.5">
                          <div>
                            <PriceFlash
                              value={currency === "USD" ? coin.price_usd : coin.price_idr}
                              type="inline"
                              className={`font-black tabular-nums tracking-tight ${
                                isHero ? "text-xl sm:text-2xl" : "text-sm sm:text-base"
                              }`}
                            >
                              {formatPrice(coin.price_usd, coin.price_idr)}
                            </PriceFlash>
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span>
                              {change >= 0 ? "▲ +" : "▼ "}
                              {change.toFixed(2)}%
                            </span>
                            <span className="text-[10px] opacity-75">
                              {formatBigNum(coin.market_cap_usd, coin.market_cap_idr)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── ALL COINS CONTINUOUS VIEW ────────────────────────────────────────── */}
      {data && viewMode === "all" && (
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-white/[0.06]">
            <h2 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-zinc-100">
              Top 50 Kripto Terbesar (Global Market Cap)
            </h2>
            <span className="text-xs text-zinc-400">
              Menampilkan {filteredItems.length} aset kripto
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 auto-rows-fr">
            {filteredItems.slice(0, 54).map((coin, index) => {
              const change = coin.change_24h ?? 0;
              const style = getChangeColor(change);
              const isMegaHero = index === 0; // BTC
              const isHero = index === 1; // ETH

              return (
                <Link
                  key={coin.symbol}
                  href={`/crypto/${coin.symbol}`}
                  onMouseEnter={() => setHoveredCoin(coin)}
                  onMouseLeave={() => setHoveredCoin(null)}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 shadow-sm transition-all duration-200 hover:scale-[1.03] hover:shadow-lg hover:z-20 ${
                    style.bg
                  } ${style.border} ${style.text} ${
                    isMegaHero
                      ? "col-span-2 row-span-2 sm:col-span-3 sm:row-span-2 p-5"
                      : isHero
                      ? "col-span-2 row-span-2 p-5"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CoinIcon
                        symbol={coin.symbol}
                        name={coin.name}
                        className={isMegaHero || isHero ? "h-9 w-9" : "h-7 w-7"}
                        size={isMegaHero || isHero ? 36 : 28}
                      />
                      <div>
                        <div className={`font-black tracking-tight ${isMegaHero ? "text-xl" : isHero ? "text-lg" : "text-sm"}`}>
                          {coin.symbol}
                        </div>
                        <div className="text-[10px] opacity-80 truncate max-w-[100px]">
                          {coin.name}
                        </div>
                      </div>
                    </div>

                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${style.badge}`}>
                      #{coin.rank}
                    </span>
                  </div>

                  <div className="mt-3 space-y-0.5">
                    <div>
                      <PriceFlash
                        value={currency === "USD" ? coin.price_usd : coin.price_idr}
                        type="inline"
                        className={`font-black tabular-nums tracking-tight ${
                          isMegaHero ? "text-2xl sm:text-3xl" : isHero ? "text-xl sm:text-2xl" : "text-sm sm:text-base"
                        }`}
                      >
                        {formatPrice(coin.price_usd, coin.price_idr)}
                      </PriceFlash>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span>
                        {change >= 0 ? "▲ +" : "▼ "}
                        {change.toFixed(2)}%
                      </span>
                      <span className="text-[10px] opacity-75">
                        {formatBigNum(coin.market_cap_usd, coin.market_cap_idr)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Color Legend Bar (Apple Style) ──────────────────────────────────── */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="font-bold text-zinc-700 dark:text-zinc-300">
            Skala Warna Kinerja ({"24 jam"}):
          </span>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="rounded-md bg-rose-700 px-2 py-0.5 text-[10px] font-bold text-white">
              ≤ -5%
            </span>
            <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
              -3%
            </span>
            <span className="rounded-md bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
              -1%
            </span>
            <span className="rounded-md bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">
              0% - +2%
            </span>
            <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
              +2% - +5%
            </span>
            <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              ≥ +5%
            </span>
          </div>

          <span className="text-[11px] text-zinc-400">
            Kutipan Binance Spot atau Yahoo Finance ? IDR memakai kurs acuan Rp15.850
          </span>
        </div>
      </Card>
    </main>
  );
}

