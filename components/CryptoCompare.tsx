"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CryptoDetailData, CryptoItem } from "@/lib/types";
import { Card } from "./ui";
import { CoinIcon } from "./CoinIcon";
import { PriceFlash } from "./PriceFlash";

const MAX_COMPARE = 4;

const QUICK_PRESETS = [
  { label: "👑 Raja Kripto", coins: ["BTC", "ETH", "SOL"] },
  { label: "⚡ Layer 1 Titans", coins: ["ETH", "SOL", "BNB", "ADA"] },
  { label: "🦄 DeFi Leaders", coins: ["UNI", "AAVE", "LINK", "MKR"] },
  { label: "🤖 AI & Big Data", coins: ["NEAR", "ICP", "FET", "RENDER"] },
  { label: "🐶 Top Meme", coins: ["DOGE", "SHIB", "PEPE"] },
];

export function CryptoCompare() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Selected coin symbols from URL query (default to BTC & ETH)
  const queryCoins = searchParams.get("coins");
  const initialSymbols = useMemo(() => {
    if (queryCoins) {
      return queryCoins
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, MAX_COMPARE);
    }
    return ["BTC", "ETH", "SOL"];
  }, [queryCoins]);

  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(initialSymbols);
  const [details, setDetails] = useState<Record<string, CryptoDetailData>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [allCoins, setAllCoins] = useState<CryptoItem[]>([]);
  const [currency, setCurrency] = useState<"IDR" | "USD">("IDR");
  const [searchPicker, setSearchPicker] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Sync URL when selectedSymbols change
  const updateSymbols = (newSymbols: string[]) => {
    setSelectedSymbols(newSymbols);
    const p = new URLSearchParams();
    if (newSymbols.length > 0) {
      p.set("coins", newSymbols.join(","));
    }
    router.replace(`/crypto/bandingkan?${p.toString()}`);
  };

  // Fetch available coins list for the picker
  useEffect(() => {
    fetch("/api/crypto?size=100&sort=mcap")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { items?: CryptoItem[] } | null) => {
        if (j?.items) setAllCoins(j.items);
      })
      .catch(() => {});
  }, []);

  // Fetch detail for each selected coin
  useEffect(() => {
    selectedSymbols.forEach((sym) => {
      if (details[sym] || loadingMap[sym]) return;

      setLoadingMap((prev) => ({ ...prev, [sym]: true }));
      fetch(`/api/crypto/${sym}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: CryptoDetailData | null) => {
          if (data) {
            setDetails((prev) => ({ ...prev, [sym]: data }));
          }
        })
        .catch(() => {})
        .finally(() => {
          setLoadingMap((prev) => ({ ...prev, [sym]: false }));
        });
    });
  }, [selectedSymbols, details, loadingMap]);

  // Refresh only quotes once the initial analysis has loaded.
  useEffect(() => {
    if (selectedSymbols.length === 0) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      selectedSymbols.forEach((sym) => {
        fetch("/api/crypto/" + encodeURIComponent(sym) + "?quote=1")
          .then((r) => r.ok ? r.json() : null)
          .then((latest: CryptoItem | null) => {
            if (!latest) return;
            setDetails((prev) => {
              const current = prev[sym];
              if (!current) return prev;
              return { ...prev, [sym]: { ...current, ...latest, change_7d: current.change_7d, sparkline: current.sparkline } };
            });
          }).catch(() => {});
      });
    }, 20000);
    return () => clearInterval(interval);
  }, [selectedSymbols]);

  const removeSymbol = (sym: string) => {
    if (selectedSymbols.length <= 1) return;
    updateSymbols(selectedSymbols.filter((s) => s !== sym));
  };

  const addSymbol = (sym: string) => {
    const clean = sym.toUpperCase().trim();
    if (selectedSymbols.includes(clean) || selectedSymbols.length >= MAX_COMPARE) return;
    updateSymbols([...selectedSymbols, clean]);
    setShowAddModal(false);
    setSearchPicker("");
  };

  const formatPrice = (usd: number | null, idr: number | null) => {
    if (usd === null || idr === null) return "?";
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
      if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)} Triliun`;
      if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)} Miliar`;
      if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)} Juta`;
      return `$${usd.toLocaleString("en-US")}`;
    }
    if (idr >= 1e15) return `Rp ${(idr / 1e15).toFixed(2)} Kuadriliun`;
    if (idr >= 1e12) return `Rp ${(idr / 1e12).toFixed(2)} Triliun`;
    if (idr >= 1e9) return `Rp ${(idr / 1e9).toFixed(2)} Miliar`;
    return `Rp ${Math.round(idr).toLocaleString("id-ID")}`;
  };

  // Helper to determine the best value among compared coins
  const getBestIndex = (values: (number | null | undefined)[], mode: "max" | "min" = "max"): number | null => {
    const valid = values
      .map((v, i) => ({ v, i }))
      .filter((x): x is { v: number; i: number } => x.v !== null && x.v !== undefined && !isNaN(x.v));
    if (valid.length < 2) return null;
    valid.sort((a, b) => (mode === "max" ? b.v - a.v : a.v - b.v));
    return valid[0].v === valid[1].v ? null : valid[0].i;
  };

  const availableToAdd = useMemo(() => {
    return allCoins.filter((c) => {
      const notSelected = !selectedSymbols.includes(c.symbol);
      const match = !searchPicker.trim() ||
        c.symbol.toLowerCase().includes(searchPicker.toLowerCase()) ||
        c.name.toLowerCase().includes(searchPicker.toLowerCase());
      return notSelected && match;
    });
  }, [allCoins, selectedSymbols, searchPicker]);

  const activeCoins = selectedSymbols.map((s) => details[s]).filter(Boolean);

  return (
    <main className="screen-shell screen-section space-y-6">
      {/* ── Top Header Bar (Apple Crystal Clear Glass) ────────────────────────── */}
      <div className="crystal-intro flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="crystal-title">
              Bandingkan Kripto (Crypto Compare)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Bandingkan harga, metrik likuiditas, drawdown dari All-Time High, skor analisis kuantitatif, dan riwayat return secara berdampingan.
          </p>
        </div>

        {/* Currency & Heatmap Link */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/crypto/heatmap"
            className="flex items-center gap-1.5 rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-2 text-xs font-semibold text-zinc-800 shadow-xs backdrop-blur-xl transition hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:bg-[#141821]/80 dark:text-zinc-200 dark:hover:text-emerald-300"
          >
            <span>🗺️</span>
            <span>Buka Peta Panas (Heatmap) →</span>
          </Link>

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
        </div>
      </div>

      {/* ── Quick Preset Chips ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Preset Cepat:
        </span>
        {QUICK_PRESETS.map((p) => {
          const isActive =
            p.coins.length === selectedSymbols.length &&
            p.coins.every((c) => selectedSymbols.includes(c));
          return (
            <button
              key={p.label}
              onClick={() => updateSymbols(p.coins)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold backdrop-blur-xl transition ${
                isActive
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-700/20"
                  : "border border-zinc-200/80 bg-white/70 text-zinc-700 hover:border-emerald-400 hover:bg-white hover:text-emerald-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-emerald-300"
              }`}
            >
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Coin Header Selector Cards ───────────────────────────────────────── */}
      <div className={`grid gap-4 ${
        selectedSymbols.length === 2
          ? "grid-cols-2"
          : selectedSymbols.length === 3
          ? "grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3"
          : "grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4"
      }`}>
        {selectedSymbols.map((sym, idx) => {
          const coin = details[sym];
          const isLoading = loadingMap[sym] && !coin;

          return (
            <Card
              key={sym}
              className="relative p-4 sm:p-5 flex flex-col justify-between border-t-4 border-t-emerald-500"
            >
              {selectedSymbols.length > 1 && (
                <button
                  onClick={() => removeSymbol(sym)}
                  title="Hapus dari perbandingan"
                  className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500 hover:bg-rose-100 hover:text-rose-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                >
                  ✕
                </button>
              )}

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-500" />
                  <span className="mt-2 text-xs text-zinc-400">Memuat {sym}...</span>
                </div>
              ) : coin ? (
                <div>
                  <div className="flex items-center gap-3">
                    <CoinIcon symbol={coin.symbol} name={coin.name} className="h-10 w-10" size={40} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/crypto/${coin.symbol}`}
                          className="text-lg font-black tracking-tight text-zinc-950 hover:underline dark:text-zinc-100"
                        >
                          {coin.symbol}
                        </Link>
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          #{coin.rank}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 truncate max-w-[140px]">{coin.name}</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
                    <div>
                      <PriceFlash
                        value={currency === "USD" ? coin.price_usd : coin.price_idr}
                        type="hero"
                        className="text-xl sm:text-2xl font-black tabular-nums text-zinc-950 dark:text-zinc-100"
                      >
                        {formatPrice(coin.price_usd, coin.price_idr)}
                      </PriceFlash>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{coin.stale ? "Tersimpan ? " : ""}{coin.quoteSource} ({coin.quoteCurrency})</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs font-bold">
                      <span
                        className={
                          coin.change_24h !== null && coin.change_24h >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }
                      >
                        {coin.change_24h !== null && coin.change_24h >= 0 ? "▲ +" : "▼ "}
                        {coin.change_24h === null ? "?" : coin.change_24h.toFixed(2) + "%"} (24j)
                      </span>
                      <span className="text-zinc-400 font-normal">·</span>
                      <span
                        className={
                          coin.change_7d !== null && coin.change_7d >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }
                      >
                        {coin.change_7d !== null && coin.change_7d >= 0 ? "+" : ""}
                        {coin.change_7d === null ? "?" : coin.change_7d.toFixed(2) + "%"} (7h)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-rose-500">
                  Data {sym} tidak ditemukan
                </div>
              )}
            </Card>
          );
        })}

        {/* Add Coin Card if less than MAX_COMPARE */}
        {selectedSymbols.length < MAX_COMPARE && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl border-2 border-dashed border-zinc-300/80 p-6 text-center transition hover:border-emerald-500 hover:bg-emerald-50/20 dark:border-white/10 dark:hover:border-emerald-400/50 dark:hover:bg-emerald-950/10 min-h-[140px]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-xl font-bold text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
              +
            </span>
            <span className="mt-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Tambah Koin Perbandingan
            </span>
            <span className="text-[10px] text-zinc-400">
              Maksimal {MAX_COMPARE} koin
            </span>
          </button>
        )}
      </div>

      {/* ── Add Coin Picker Modal ────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
          <div className="ios-glass-canvas viewport-dialog relative w-full max-w-md space-y-4 rounded-3xl p-4 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-zinc-200/70 pb-3 dark:border-white/10">
              <h3 className="font-black text-[#191919] dark:text-white text-base">
                Pilih Kripto untuk Dibandingkan
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-full h-8 w-8 flex items-center justify-center border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-xs font-bold text-xs shrink-0 transition"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              value={searchPicker}
              onChange={(e) => setSearchPicker(e.target.value)}
              placeholder="Ketik simbol atau nama koin (contoh: SOL, XRP, SUI)..."
              className="ios-glass-subtle w-full rounded-2xl border border-zinc-200/80 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#9A83FF]/40 text-[#191919] dark:text-white transition"
              autoFocus
            />

            <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {availableToAdd.map((coin) => (
                <button
                  key={coin.symbol}
                  onClick={() => addSymbol(coin.symbol)}
                  className="w-full flex items-center justify-between p-2.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl"
                >
                  <div className="flex items-center gap-2.5">
                    <CoinIcon symbol={coin.symbol} name={coin.name} className="h-7 w-7" size={28} />
                    <div>
                      <span className="font-bold text-xs text-zinc-950 dark:text-zinc-100">
                        {coin.symbol}
                      </span>
                      <span className="ml-1.5 text-[11px] text-zinc-400 truncate">{coin.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatPrice(coin.price_usd, coin.price_idr)}
                    </span>
                    <span
                      className={`block text-[10px] font-bold ${
                        coin.change_24h !== null && coin.change_24h >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {coin.change_24h !== null && coin.change_24h >= 0 ? "+" : ""}
                      {coin.change_24h === null ? "?" : coin.change_24h.toFixed(2) + "%"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DETAILED SIDE-BY-SIDE COMPARISON SECTIONS ────────────────────────── */}
      {activeCoins.length >= 2 && (
        <div className="space-y-6">
          {/* SECTION 1: Valuasi & Likuiditas */}
          <Card className="p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-100 flex items-center gap-2">
              <span>📊</span>
              <span>Valuasi &amp; Likuiditas Pasar</span>
            </h2>

            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-white/[0.06] text-zinc-400 text-left">
                    <th className="py-2.5 px-3 font-semibold w-1/4">Metrik</th>
                    {activeCoins.map((c) => (
                      <th key={c.symbol} className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100 text-right">
                        {c.symbol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {/* Market Cap */}
                  {(() => {
                    const best = getBestIndex(activeCoins.map((c) => c.market_cap_usd), "max");
                    return (
                      <tr>
                        <td className="py-3 px-3 font-medium text-zinc-600 dark:text-zinc-400">Kapitalisasi Pasar</td>
                        {activeCoins.map((c, i) => (
                          <td key={c.symbol} className="py-3 px-3 text-right tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
                            {formatBigNum(c.market_cap_usd, c.market_cap_idr)}
                            {i === best && (
                              <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Tertinggi
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })()}

                  {/* 24h Volume */}
                  {(() => {
                    const best = getBestIndex(activeCoins.map((c) => c.volume_24h_usd), "max");
                    return (
                      <tr>
                        <td className="py-3 px-3 font-medium text-zinc-600 dark:text-zinc-400">Volume Transaksi 24 Jam</td>
                        {activeCoins.map((c, i) => (
                          <td key={c.symbol} className="py-3 px-3 text-right tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
                            {formatBigNum(c.volume_24h_usd, c.volume_24h_idr)}
                            {i === best && (
                              <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Terbesar
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })()}

                  {/* Turnover Ratio (Volume / Cap) */}
                  {(() => {
                    const ratios = activeCoins.map((c) => (c.market_cap_usd && c.volume_24h_usd !== null ? (c.volume_24h_usd / c.market_cap_usd) * 100 : null));
                    const best = getBestIndex(ratios, "max");
                    return (
                      <tr>
                        <td className="py-3 px-3 font-medium text-zinc-600 dark:text-zinc-400">Rasio Likuiditas (Vol / Cap)</td>
                        {activeCoins.map((c, i) => (
                          <td key={c.symbol} className="py-3 px-3 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                            {ratios[i] === null ? "?" : ratios[i]?.toFixed(2) + "%"}
                            {i === best && (
                              <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Paling Likuid
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })()}

                  {/* Circulating Supply */}
                  <tr>
                    <td className="py-3 px-3 font-medium text-zinc-600 dark:text-zinc-400">Suplai Beredar</td>
                    {activeCoins.map((c) => (
                      <td key={c.symbol} className="py-3 px-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                        {c.circulating_supply === null ? "?" : Math.round(c.circulating_supply).toLocaleString("id-ID")} {c.symbol}
                        {c.max_supply && c.circulating_supply !== null && (
                          <span className="block text-[10px] text-zinc-400">
                            {((c.circulating_supply / c.max_supply) * 100).toFixed(1)}% dari Max Suplai
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>


          {/* SECTION 3: Analisis Kuantitatif & Rekomendasi */}
          <Card className="p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-100 flex items-center gap-2">
              <span>🧠</span>
              <span>Skor Rekomendasi &amp; Indikator Kuantitatif</span>
            </h2>

            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-white/[0.06] text-zinc-400 text-left">
                    <th className="py-2.5 px-3 font-semibold w-1/4">Metrik</th>
                    {activeCoins.map((c) => (
                      <th key={c.symbol} className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100 text-right">
                        {c.symbol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {/* Consensus Signal */}
                  <tr>
                    <td className="py-3 px-3 font-medium text-zinc-600 dark:text-zinc-400">Sinyal Konsensus</td>
                    {activeCoins.map((c) => {
                      const sig = c.recommendation?.signal ?? "Tidak tersedia";
                      const isBuy = sig.includes("BUY");
                      return (
                        <td key={c.symbol} className="py-3 px-3 text-right">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              isBuy
                                ? "bg-emerald-500 text-white"
                                : sig === "NEUTRAL" || sig === "Tidak tersedia"
                                ? "bg-amber-400 text-zinc-950"
                                : "bg-rose-500 text-white"
                            }`}
                          >
                            {sig}
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Recommendation Score */}
                  {(() => {
                    const best = getBestIndex(activeCoins.map((c) => c.recommendation?.score), "max");
                    return (
                      <tr>
                        <td className="py-3 px-3 font-medium text-zinc-600 dark:text-zinc-400">Skor Kuantitatif (0-100)</td>
                        {activeCoins.map((c, i) => (
                          <td key={c.symbol} className="py-3 px-3 text-right tabular-nums font-black text-sm text-zinc-950 dark:text-zinc-100">
                            {c.recommendation ? c.recommendation.score + "/100" : "?"}
                            {i === best && (
                              <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Skor Tertinggi
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })()}

                  {/* RSI 14 */}
                  <tr>
                    <td className="py-3 px-3 font-medium text-zinc-600 dark:text-zinc-400">RSI 14 Hari</td>
                    {activeCoins.map((c) => {
                      const rsi = c.recommendation?.indicators?.rsi14?.value;
                      return (
                        <td key={c.symbol} className="py-3 px-3 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                          {rsi?.toFixed(1) ?? "?"}
                          <span className="block text-[10px] text-zinc-400 font-normal">
                            {rsi === undefined ? "Data tidak tersedia" : rsi < 30 ? "Oversold (Jenuh Jual)" : rsi > 70 ? "Overbought (Jenuh Beli)" : "Netral"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Moving Average Trend */}
                  <tr>
                    <td className="py-3 px-3 font-medium text-zinc-600 dark:text-zinc-400">Tren Rata-rata Bergerak (EMA)</td>
                    {activeCoins.map((c) => {
                      const trend = c.recommendation?.indicators?.maTrend?.signal ?? "Tidak tersedia";
                      return (
                        <td key={c.symbol} className="py-3 px-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                          <span className={trend === "Bullish" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                            {trend}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* SECTION 4: Historis Return Simulasi */}
          <Card className="p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-100 flex items-center gap-2">
              <span>📈</span>
              <span>Kinerja Return Historis (Simulasi Investasi)</span>
            </h2>

            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-white/[0.06] text-zinc-400 text-left">
                    <th className="py-2.5 px-3 font-semibold w-1/4">Periode</th>
                    {activeCoins.map((c) => (
                      <th key={c.symbol} className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100 text-right">
                        {c.symbol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {/* 1 Month Return */}
                  {(() => {
                    const returns = activeCoins.map((c) => {
                      const sim = c.returnSimulations?.find((s) => s.period.includes("1 Bulan"));
                      return sim ? sim.roiPct : null;
                    });
                    const best = getBestIndex(returns, "max");
                    return (
                      <tr>
                        <td className="py-3 px-3 font-medium text-zinc-600 dark:text-zinc-400">1 Bulan Lalu</td>
                        {returns.map((ret, i) => (
                          <td
                            key={activeCoins[i].symbol}
                            className={`py-3 px-3 text-right tabular-nums font-bold ${
                              (ret ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {ret !== null ? `${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%` : "-"}
                            {i === best && (
                              <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Juara
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })()}

                  {/* 1 Year Return */}
                  {(() => {
                    const returns = activeCoins.map((c) => {
                      const sim = c.returnSimulations?.find((s) => s.period.includes("1 Tahun"));
                      return sim ? sim.roiPct : null;
                    });
                    const best = getBestIndex(returns, "max");
                    return (
                      <tr>
                        <td className="py-3 px-3 font-medium text-zinc-600 dark:text-zinc-400">1 Tahun Lalu</td>
                        {returns.map((ret, i) => (
                          <td
                            key={activeCoins[i].symbol}
                            className={`py-3 px-3 text-right tabular-nums font-bold ${
                              (ret ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {ret !== null ? `${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%` : "-"}
                            {i === best && (
                              <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Juara
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })()}

                </tbody>
              </table>
            </div>
          </Card>

          {/* SECTION 5: Whitepaper, Riset CMC, dan Link Resmi */}
          <Card className="p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-100 flex items-center gap-2">
              <span>📄</span>
              <span>Dokumentasi Whitepaper &amp; Riset Resmi</span>
            </h2>

            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-4">
              {activeCoins.map((c) => (
                <div key={c.symbol} className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-white/[0.06] dark:bg-zinc-800/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <CoinIcon symbol={c.symbol} name={c.name} className="h-6 w-6" size={24} />
                    <span className="font-bold text-sm text-zinc-950 dark:text-zinc-100">{c.name}</span>
                  </div>

                  <p className="text-[11px] text-zinc-500 line-clamp-3 leading-relaxed">
                    {c.description}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-zinc-200/60 dark:border-white/[0.06]">
                    {c.whitepaper_url && (
                      <a
                        href={c.whitepaper_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl border border-emerald-300/80 bg-emerald-50 px-3 py-1.5 text-center text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        📄 Whitepaper Resmi ↗
                      </a>
                    )}
                    {c.cmc_url && (
                      <a
                        href={c.cmc_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-center text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        📊 CoinMarketCap Riset ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
