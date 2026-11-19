"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CryptoCategory, CryptoFearGreed, CryptoItem } from "@/lib/types";
import { Card } from "./ui";
import { CoinIcon } from "./CoinIcon";
import { PriceFlash } from "./PriceFlash";

const CATEGORIES: CryptoCategory[] = [
  "Semua",
  "Layer 1",
  "Layer 2",
  "DeFi",
  "AI & Big Data",
  "Meme",
  "Infrastructure",
  "Payments",
  "Stablecoin",
  "Lainnya",
];

interface CryptoApiResponse {
  items: CryptoItem[];
  total: number;
  page: number;
  pages: number;
  updatedAt: number | null;
  availability: "available" | "stale" | "unavailable";
  stats: {
    totalMarketCapUsd: number | null;
    totalVolume24hUsd: number | null;
    btcDominance: number | null;
    marketCapCoverage: number;
    volumeCoverage: number;
    fearGreed: CryptoFearGreed;
  };
}

export function CryptoList() {
  const [data, setData] = useState<CryptoApiResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<"IDR" | "USD">("IDR");
  const [category, setCategory] = useState<CryptoCategory>("Semua");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"mcap" | "price" | "change_24h" | "volume">("mcap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async (force = false, isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        size: "25",
        sort: sortKey,
        dir: sortDir,
        ...(search ? { q: search } : {}),
        ...(category !== "Semua" ? { category } : {}),
        ...(force ? { refresh: "1" } : {}),
      });
      const res = await fetch(`/api/crypto?${q}`);
      if (!res.ok) throw new Error("Gagal mengambil data");
      const json: CryptoApiResponse = await res.json();
      setData(json);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [category, search, sortKey, sortDir, page]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchData(false, true);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, category, search, sortKey, sortDir, page]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const formatPrice = (usd: number, idr: number) => {
    if (currency === "USD") {
      if (usd >= 1) {
        return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
    }
    if (idr >= 1000) {
      return `Rp ${idr.toLocaleString("id-ID")}`;
    }
    return `Rp ${idr.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  };

  const formatBigNum = (usd: number | null, idr: number | null) => {
    if (usd === null || idr === null) return "?";
    if (currency === "USD") {
      if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)} Triliun`;
      if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)} Miliar`;
      if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)} Juta`;
      return `$${usd.toLocaleString("en-US")}`;
    }
    if (idr >= 1e15) return `Rp ${(idr / 1e15).toFixed(2)} Kuadriliun`;
    if (idr >= 1e12) return `Rp ${(idr / 1e12).toFixed(2)} Triliun`;
    if (idr >= 1e9) return `Rp ${(idr / 1e9).toFixed(2)} Miliar`;
    return `Rp ${idr.toLocaleString("id-ID")}`;
  };

  return (
    <main className="screen-shell space-y-8 screen-section">
      {/* Overview Stats Bar */}
      {data?.stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          <Card className="p-5 sm:p-6">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Kapitalisasi Terpantau</span>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 sm:text-xl">
              {formatBigNum(data.stats.totalMarketCapUsd, data.stats.totalMarketCapUsd === null ? null : data.stats.totalMarketCapUsd * 15850)}
            </p>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Yahoo Finance ? {data.stats.marketCapCoverage} aset</span>
          </Card>

          <Card className="p-5 sm:p-6">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Volume Spot 24 Jam</span>
            <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 sm:text-xl">
              {formatBigNum(data.stats.totalVolume24hUsd, data.stats.totalVolume24hUsd === null ? null : data.stats.totalVolume24hUsd * 15850)}
            </p>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Binance Spot ? {data.stats.volumeCoverage} aset</span>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Porsi BTC Terpantau</span>
            </div>
            <p className="mt-2 text-lg font-bold text-orange-600 dark:text-orange-400 sm:text-xl">
              {data.stats.btcDominance === null ? "?" : data.stats.btcDominance.toFixed(1) + "%"}
            </p>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Dari kapitalisasi yang tersedia
            </span>
          </Card>

          {(() => {
            const index = data.stats.fearGreed;
            const fg = index.value ?? -1;
            const fgStyle =
              fg < 0 ? { text: "text-zinc-500", badge: "text-zinc-500", hint: "Data tidak tersedia" } : fg >= 75
                ? {
                    text: "text-emerald-600 dark:text-emerald-400 font-black",
                    badge: "bg-emerald-500 text-white dark:bg-emerald-600 border border-emerald-600",
                    hint: "Keserakahan Ekstrem (Sangat Bullish)",
                  }
                : fg >= 55
                ? {
                    text: "text-emerald-600 dark:text-emerald-400 font-bold",
                    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-850",
                    hint: "Optimisme Pasar Sehat (Greed)",
                  }
                : fg >= 45
                ? {
                    text: "text-amber-600 dark:text-amber-400 font-bold",
                    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-850",
                    hint: "Konsolidasi / Pasar Netral",
                  }
                : fg >= 25
                ? {
                    text: "text-orange-600 dark:text-orange-400 font-bold",
                    badge: "bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-300 dark:border-orange-850",
                    hint: "Sentimen Khawatir (Fear)",
                  }
                : {
                    text: "text-rose-600 dark:text-rose-400 font-black",
                    badge: "bg-rose-500 text-white dark:bg-rose-600 border border-rose-600",
                    hint: "Ketakutan Ekstrem (Extreme Fear)",
                  };

            return (
              <Card className="p-5 sm:p-6">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Crypto Fear &amp; Greed</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-lg sm:text-xl ${fgStyle.text}`}>
                    {index.value === null ? "?" : index.value + "/100"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${fgStyle.badge}`}>
                    {index.sentiment}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Alternative.me{index.stale ? " ? Data tersimpan" : ""}{index.observedAt !== null ? " ? " + new Date(index.observedAt).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) : ""}</span>
              </Card>
            );
          })()}
        </div>
      )}

      {/* Control & Filter Strip */}
      <div className="crystal-intro flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="crystal-title">
            Pasar Cryptocurrency
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Daftar koin kripto global berperingkat kapitalisasi pasar terbesar dengan live spot Binance (USDT) &amp; rekomendasi kuantitatif.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Currency Toggle */}
          <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => setCurrency("IDR")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                currency === "IDR"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Rp IDR
            </button>
            <button
              onClick={() => setCurrency("USD")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                currency === "USD"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              $ USD
            </button>
          </div>

          {/* Quick Links to Heatmap & Compare */}
          <Link
            href="/crypto/heatmap"
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300/80 bg-emerald-50/80 px-3.5 py-2 text-xs font-bold text-emerald-800 backdrop-blur-md transition hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <span>🗺️</span>
            <span>Peta Panas</span>
          </Link>
          <Link
            href="/crypto/bandingkan"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white/80 px-3.5 py-2 text-xs font-semibold text-zinc-800 backdrop-blur-md transition hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-200"
          >
            <span>⚖️</span>
            <span>Bandingkan</span>
          </Link>

          {/* Auto Refresh & Manual Button */}
          <button
            onClick={() => fetchData(true)}
            title="Muat ulang data harga sekarang"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 shadow-xs transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span>↻</span>
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">15 dtk</span>
          </label>
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Category Chips */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategory(cat);
                  setPage(1);
                }}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                  category === cat
                    ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari koin (BTC, Solana, ETH...)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-64 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 pl-9 text-xs text-zinc-900 placeholder-zinc-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            <span className="pointer-events-none absolute left-3 top-2.5 text-zinc-400">🔍</span>
          </div>
        </div>
      </div>

      {/* Crypto Table Card */}
      <Card className="overflow-hidden p-0 rounded-2xl">
        <div className="table-scroll">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/75 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3.5 text-center w-12">#</th>
                <th className="px-4 py-3.5">Koin</th>
                <th className="px-4 py-3.5">Kategori</th>
                <th
                  onClick={() => handleSort("price")}
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                >
                  Harga {sortKey === "price" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th
                  onClick={() => handleSort("change_24h")}
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                >
                  24 Jam % {sortKey === "change_24h" && (sortDir === "asc" ? "▲" : "▼")}
                </th>

                <th
                  onClick={() => handleSort("volume")}
                  className="px-4 py-3.5 text-right hidden lg:table-cell cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                >
                  Volume (24J) {sortKey === "volume" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th
                  onClick={() => handleSort("mcap")}
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                >
                  Kapitalisasi Pasar {sortKey === "mcap" && (sortDir === "asc" ? "▲" : "▼")}
                </th>

                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-sans">
              {loading && !data ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    Memuat data cryptocurrency...
                  </td>
                </tr>
              ) : failed || !data || data.availability === "unavailable" || data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {failed || !data || data.availability === "unavailable" ? "Kutipan kripto belum tersedia. Coba perbarui data." : "Tidak ada koin yang sesuai dengan filter pencarian."}
                  </td>
                </tr>
              ) : (
                data?.items.map((c) => {
                  const isUp24 = (c.change_24h ?? 0) >= 0;

                  return (
                    <tr
                      key={c.symbol}
                      className="group transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
                    >
                      {/* Rank */}
                      <td className="px-4 py-3.5 text-center text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                        {c.stale ? "?" : c.rank ?? "?"}
                      </td>

                      {/* Coin Symbol & Name */}
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/crypto/${c.symbol.toLowerCase()}`}
                          className="flex items-center gap-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                        >
                          <CoinIcon symbol={c.symbol} name={c.name} className="h-8 w-8" size={32} />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-zinc-900 dark:text-zinc-100">{c.symbol}</span>
                              <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:inline">
                                {c.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-400 sm:hidden">{c.name}</span>
                          </div>
                        </Link>
                      </td>

                      {/* Category Badge */}
                      <td className="px-4 py-3.5">
                        <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {c.category}
                        </span>
                      </td>

                      {/* Price with Realtime Flash Animation */}
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        <PriceFlash value={currency === "USD" ? c.price_usd : c.price_idr}>
                          {formatPrice(c.price_usd, c.price_idr)}
                        </PriceFlash>
                        <span className="block text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                          {c.stale ? "Tersimpan ? " : ""}{c.quoteSource} ({c.quoteCurrency})
                          {c.observedAt && <time className="block" dateTime={new Date(c.observedAt).toISOString()}>{new Date(c.observedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB</time>}
                        </span>
                      </td>

                      {/* 24h Change */}
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <span
                          className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold ${
                            isUp24
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          }`}
                        >
                          {c.change_24h === null ? "?" : (isUp24 ? "+" : "") + c.change_24h.toFixed(2) + "%"}
                        </span>
                      </td>

                      {/* Volume 24h */}
                      <td className="px-4 py-3.5 text-right tabular-nums text-xs text-zinc-600 dark:text-zinc-300 hidden lg:table-cell">
                        {formatBigNum(c.volume_24h_usd, c.volume_24h_idr)}
                      </td>

                      {/* Market Cap */}
                      <td className="px-4 py-3.5 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                        {formatBigNum(c.market_cap_usd, c.market_cap_idr)}
                      </td>



                      {/* Action Detail Link */}
                      <td className="px-4 py-3.5 text-center">
                        <Link
                          href={`/crypto/${c.symbol.toLowerCase()}`}
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-xs transition hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                        >
                          Analisa
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Menampilkan {data.items.length} dari {data.total} koin terdaftar di bursa Binance Spot (Halaman {data.page} dari {data.pages})
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-xs disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                ← Sebelumnya
              </button>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-xs disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                Selanjutnya →
              </button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}

