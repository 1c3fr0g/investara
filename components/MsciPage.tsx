"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import type { ListItem } from "@/lib/types";
import {
  MSCI_STANDARD,
  MSCI_SMALLCAP,
  MSCI_ALL,
  MSCI_METADATA,
  MSCI_REBALANCING_CALENDAR,
  MSCI_CRITERIA,
} from "@/lib/msci";
import { Card } from "./ui";
import { StockLogo } from "./StockLogo";
import { PriceFlash, LiveBadge } from "./PriceFlash";

export function MsciPage() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"standard" | "smallcap" | "all" | "methodology">("standard");
  const [search, setSearch] = useState("");
  const [selectedSector, setSelectedSector] = useState("Semua");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch stocks universe
  const fetchData = (isBackground = false) => {
    if (!isBackground) setLoading(true);
    const query = new URLSearchParams({ kodes: MSCI_ALL.join(","), size: String(MSCI_ALL.length) });
    fetch(`/api/saham?${query}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal mengambil data saham");
        return res.json();
      })
      .then((data) => {
        if (data?.items && Array.isArray(data.items)) {
          setItems(data.items);
          setError(null);
        }
      })
      .catch((err) => {
        if (!isBackground) setError(err.message);
      })
      .finally(() => {
        if (!isBackground) setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Live Auto-Refresh every 25 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchData(true);
    }, 25000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Map and filter items according to active tab
  const standardSet = useMemo(() => new Set(MSCI_STANDARD), []);
  const smallcapSet = useMemo(() => new Set(MSCI_SMALLCAP), []);
  const allMsciSet = useMemo(() => new Set(MSCI_ALL), []);

  const activeCodes = useMemo(() => {
    if (activeTab === "standard") return standardSet;
    if (activeTab === "smallcap") return smallcapSet;
    return allMsciSet;
  }, [activeTab, standardSet, smallcapSet, allMsciSet]);

  const msciStocks = useMemo(() => {
    return items
      .filter((s) => activeCodes.has(s.kode))
      .filter((s) => {
        const matchesQ =
          !search ||
          s.kode.toLowerCase().includes(search.toLowerCase()) ||
          s.nama.toLowerCase().includes(search.toLowerCase());
        const matchesSec = selectedSector === "Semua" || s.sektor === selectedSector;
        return matchesQ && matchesSec;
      })
      .sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0));
  }, [items, activeCodes, search, selectedSector]);

  // Unique sectors among MSCI constituents
  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    items.forEach((s) => {
      if (allMsciSet.has(s.kode) && s.sektor) set.add(s.sektor);
    });
    return ["Semua", ...Array.from(set).sort()];
  }, [items, allMsciSet]);

  // Aggregate Stats
  const totalsBySector = new Map<string, number>();
  let totalMcap = 0;
  for (const item of items) {
    if (!allMsciSet.has(item.kode) || item.mcap == null || item.mcap <= 0) continue;
    totalMcap += item.mcap;
    if (item.sektor) totalsBySector.set(item.sektor, (totalsBySector.get(item.sektor) ?? 0) + item.mcap);
  }
  const largestSector = [...totalsBySector].sort((a, b) => b[1] - a[1])[0];

  const openAiChatForStock = (kode: string) => {
    window.dispatchEvent(
      new CustomEvent("open-ai-chat", {
        detail: { asset: kode, type: "stock" },
      })
    );
  };

  return (
    <main className="screen-shell space-y-8 screen-section">
      {/* Top Header & Breadcrumbs */}
      <div className="crystal-intro flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span>🌍 Global Benchmark</span>
            <span>•</span>
            <span>Morgan Stanley Capital International</span>
          </div>
          <h1 className="crystal-title mt-1">
            Klasifikasi &amp; Indeks MSCI Indonesia
          </h1>
          <p className="mt-1 max-w-2xl text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
            Daftar konstituen acuan Investara dan harga dari penyedia. Perubahan keanggotaan mengikuti pengumuman MSCI.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <LiveBadge label="Live Refresh" />
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs backdrop-blur-md transition hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:text-emerald-400"
          >
            <span>🔄</span>
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="p-4 sm:p-5 rounded-2xl">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Total Konstituen MSCI</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100">
              {MSCI_ALL.length}
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Emiten Terpilih
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            {MSCI_STANDARD.length} Standard + {MSCI_SMALLCAP.length} Small Cap
          </p>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Total Market Cap Terpantau</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {totalMcap > 0 ? `Rp ${(totalMcap / 1e12).toFixed(1)} T` : "Belum tersedia"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            Kapitalisasi emiten acuan yang tersedia
          </p>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Pilar Sektor Terbesar</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">
              {largestSector?.[0] ?? "Belum tersedia"}
            </span>
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              {largestSector && totalMcap > 0 ? `${(largestSector[1] / totalMcap * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : ""}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            Porsi dari kapitalisasi yang tersedia
          </p>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Siklus Review</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400">
              Kuartalan
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            Lihat rincian di tab jadwal rebalancing
          </p>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200/80 pb-3 dark:border-white/10">
        <button
          onClick={() => setActiveTab("standard")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === "standard"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          🏆 MSCI Standard Index ({MSCI_STANDARD.length})
        </button>

        <button
          onClick={() => setActiveTab("smallcap")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === "smallcap"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          🚀 MSCI Small Cap Index ({MSCI_SMALLCAP.length})
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === "all"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          🌐 Semua Konstituen MSCI IMI ({MSCI_ALL.length})
        </button>

        <button
          onClick={() => setActiveTab("methodology")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === "methodology"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          📖 Metodologi &amp; Jadwal Rebalancing
        </button>
      </div>

      {/* METHODOLOGY & REBALANCING TAB VIEW */}
      {activeTab === "methodology" ? (
        <div className="space-y-6">
          <Card className="p-6 sm:p-7 rounded-2xl">
            <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">
              Syarat &amp; Kriteria Saham Masuk Indeks MSCI
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              MSCI (Morgan Stanley Capital International) menerapkan metodologi Global Investable Market Indexes (GIMI) yang sangat ketat untuk menyaring saham yang layak diinvestasikan oleh dana institusi global.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {MSCI_CRITERIA.map((crit) => (
                <div
                  key={crit.id}
                  className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{crit.icon}</span>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                      {crit.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {crit.desc}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 sm:p-7 rounded-2xl">
            <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">
              Kalender Rebalancing Indeks MSCI (Quarterly &amp; Semi-Annual)
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Setiap kali hasil rebalancing diumumkan, manajer investasi pasif (seperti BlackRock iShares EIDO) wajib menyesuaikan portofolio pada hari penutupan efektif, menghasilkan lonjakan volume transaksi masif di sesi pra-penutupan (*closing auction*).
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MSCI_REBALANCING_CALENDAR.map((cal) => (
                <div
                  key={cal.season}
                  className="flex flex-col justify-between rounded-2xl border border-emerald-500/20 bg-emerald-50/40 p-5 dark:border-emerald-500/20 dark:bg-emerald-950/20"
                >
                  <div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {cal.type}
                    </span>
                    <h3 className="mt-3 text-base font-black text-zinc-950 dark:text-zinc-100">
                      {cal.season}
                    </h3>
                    <div className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <div>📢 Pengumuman: <strong>{cal.announcement}</strong></div>
                      <div>⚡ Efektif: <strong>{cal.effective}</strong></div>
                    </div>
                  </div>
                  <p className="mt-4 border-t border-emerald-500/10 pt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {cal.focus}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        /* CONSTITUENT LIST & SEARCH VIEW */
        <div className="space-y-4">
          {/* Search & Sector Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">🔍</span>
              <input
                type="text"
                placeholder="Cari kode atau nama emiten MSCI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-zinc-200/80 bg-white/80 py-2 pl-9 pr-4 text-xs font-medium text-zinc-900 shadow-2xs backdrop-blur-md transition focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-100"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Sektor:</span>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="rounded-xl border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs backdrop-blur-md focus:outline-hidden dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300"
              >
                {availableSectors.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table of Constituents */}
          <Card className="overflow-hidden rounded-2xl p-0">
            <div className="table-scroll">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200/80 bg-zinc-50/80 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3.5 sm:px-6">Emiten &amp; Kode</th>
                    <th className="px-3 py-3.5">Kategori MSCI</th>
                    <th className="px-3 py-3.5">Sektor</th>
                    <th className="px-3 py-3.5 text-right">Harga Terakhir</th>
                    <th className="px-3 py-3.5 text-right">Perubahan 1D</th>
                    <th className="px-3 py-3.5 text-right">Market Cap</th>
                    <th className="px-3 py-3.5 text-center">Valuasi (PER / PBV)</th>
                    <th className="px-3 py-3.5 text-center">Foreign Flow</th>
                    <th className="px-4 py-3.5 text-right sm:px-6">Aksi Analisis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-zinc-400">
                        Memuat data konstituen MSCI Indonesia...
                      </td>
                    </tr>
                  ) : msciStocks.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-zinc-400">
                        Tidak ada saham MSCI yang cocok dengan kriteria pencarian.
                      </td>
                    </tr>
                  ) : (
                    msciStocks.map((stock) => {
                      const isStd = standardSet.has(stock.kode);
                      const meta = MSCI_METADATA[stock.kode];
                      const chg = stock.perubahan_pct ?? 0;

                      return (
                        <tr
                          key={stock.kode}
                          className="transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40"
                        >
                          {/* Code & Name with Official Company Logo */}
                          <td className="px-4 py-3.5 sm:px-6">
                            <div className="flex items-center gap-3">
                              <StockLogo kode={stock.kode} size="sm" className="rounded-xl shadow-2xs shrink-0" />
                              <Link
                                href={`/saham/${stock.kode.toLowerCase()}`}
                                className="group block font-bold text-zinc-950 transition hover:text-emerald-600 dark:text-zinc-100 dark:hover:text-emerald-400"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black tracking-tight">{stock.kode}</span>
                                  {isStd && (
                                    <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                      Std
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 truncate max-w-[150px] sm:max-w-[180px] block">
                                  {stock.nama}
                                </span>
                              </Link>
                            </div>
                          </td>

                          {/* MSCI Category */}
                          <td className="px-3 py-3.5">
                            <span
                              className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                                isStd
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-300/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  : "bg-blue-50 text-blue-800 border border-blue-300/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              }`}
                            >
                              {isStd ? "Standard Index" : "Small Cap"}
                            </span>
                            {meta?.estimatedWeight && (
                              <span className="block text-[10px] text-zinc-400 mt-0.5">
                                Bobot: ~{meta.estimatedWeight}%
                              </span>
                            )}
                          </td>

                          {/* Sector */}
                          <td className="px-3 py-3.5 text-zinc-600 dark:text-zinc-400 font-medium">
                            {stock.sektor || "Umum"}
                          </td>

                          {/* Live Price with Flash Animation */}
                          <td className="px-3 py-3.5 text-right font-black tabular-nums">
                            <PriceFlash value={stock.harga}>
                              <span>
                                {stock.harga !== null ? `Rp ${stock.harga.toLocaleString("id-ID")}` : "-"}
                              </span>
                            </PriceFlash>
                          </td>

                          {/* 1D Change */}
                          <td className="px-3 py-3.5 text-right font-bold tabular-nums">
                            <span
                              className={
                                chg > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : chg < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-zinc-500"
                              }
                            >
                              {chg > 0 ? "+" : ""}
                              {chg.toFixed(2)}%
                            </span>
                          </td>

                          {/* Market Cap */}
                          <td className="px-3 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-300 font-semibold">
                            {stock.mcap
                              ? `Rp ${(stock.mcap / 1e12).toFixed(1)} T`
                              : "-"}
                          </td>

                          {/* Valuation */}
                          <td className="px-3 py-3.5 text-center text-zinc-600 dark:text-zinc-400">
                            <span>
                              {stock.per ? `${stock.per.toFixed(1)}x` : "-"} /{" "}
                              {stock.pbv ? `${stock.pbv.toFixed(1)}x` : "-"}
                            </span>
                          </td>

                          {/* Foreign Flow Status */}
                          <td className="px-3 py-3.5 text-center">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                stock.foreign_status?.includes("Akumulasi")
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : stock.foreign_status?.includes("Distribusi")
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              }`}
                            >
                              {stock.foreign_status || "Netral"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right sm:px-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openAiChatForStock(stock.kode)}
                                title={`Tanya Analis AI tentang ${stock.kode}`}
                                className="flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50/70 px-2.5 py-1 text-[11px] font-bold text-purple-700 transition hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/50"
                              >
                                <span>🤖</span>
                                <span>AI</span>
                              </button>

                              <Link
                                href={`/saham/${stock.kode.toLowerCase()}`}
                                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 shadow-2xs transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                              >
                                Detail →
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}

