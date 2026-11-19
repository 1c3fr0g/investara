"use client";

import { useEffect, useState } from "react";
import type { MacroResponse } from "@/lib/macro";
import { num, pct, rp } from "@/lib/format";
import { Card } from "./ui";

export function MacroDashboard() {
  const [data, setData] = useState<MacroResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventFilter, setEventFilter] = useState<string>("ALL");
  const [newsFilter, setNewsFilter] = useState<"all" | "global" | "domestic">("all");
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>("IDR=X");

  const loadData = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const res = await fetch(`/api/makro${force ? "?refresh=1" : ""}`);
      if (!res.ok) throw new Error("Gagal memuat data makroekonomi");
      const json: MacroResponse = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kendala jaringan");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEvents = (data?.upcomingEvents ?? []).filter((e) => {
    if (eventFilter === "ALL") return true;
    return e.category === eventFilter;
  });

  const filteredNews = (data?.news ?? []).filter((n) => {
    if (newsFilter === "all") return true;
    return n.category === newsFilter;
  });

  const activeInd = (data?.indicators ?? []).find((i) => i.symbol === selectedIndicator) ?? data?.indicators[0];

  return (
    <div className="space-y-6">
      {/* ── Top Hero Header (Apple Glassmorphism) ── */}
      <div className="crystal-intro relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/80 bg-blue-100/70 px-3 py-1 text-xs font-bold text-blue-900 backdrop-blur-md dark:border-blue-700/60 dark:bg-blue-950/60 dark:text-blue-300">
              <span className="text-sm">🌐</span> Radar Makroekonomi &amp; Geopolitik IHSG
            </div>
            <h1 className="crystal-title">
              Indikator Makro Global &amp; Kalender Pengaruh IHSG
            </h1>
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-sm">
              Pantau transmisi kebijakan <strong>The Fed</strong>, data <strong>inflasi US CPI</strong>, kurs <strong>USD/IDR</strong>, yield <strong>US 10-Year</strong>, serta jadwal rebalancing <strong>MSCI Index</strong> dan kalender suku bunga <strong>BI-Rate</strong> lengkap dengan panduan pengaruhnya terhadap bursa Indonesia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white/90 px-4 py-2.5 text-xs font-bold text-zinc-800 shadow-2xs backdrop-blur-xl transition hover:bg-white hover:border-zinc-300 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200"
            >
              <span className={refreshing ? "animate-spin" : ""}>🔄</span>
              <span>{refreshing ? "Memperbarui..." : "Segarkan Data"}</span>
            </button>
          </div>
        </div>
      </div>

      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-zinc-100 border-t-blue-500 dark:border-zinc-800 dark:border-t-blue-400" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Memuat data indikator makroekonomi...</p>
        </div>
      )}

      {error && !data && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          Gagal memuat data: {error}
        </div>
      )}

      {data && (
        <>
          {/* ── Section 1: Live Macro Indicators Ticker (Interactive Cards) ── */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>📈</span> Indikator Makro Kunci
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Klik kartu untuk membaca detail pengaruh dan sektor saham yang terdampak
                </p>
              </div>
              <div className="text-[11px] text-zinc-400">
                Sumber kutipan Yahoo Finance
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {data.indicators.map((ind) => {
                const isSelected = selectedIndicator === ind.symbol;
                const changeColor = ind.direction === "up" ? "text-emerald-600 dark:text-emerald-400" : ind.direction === "down" ? "text-rose-600 dark:text-rose-400" : "text-zinc-500 dark:text-zinc-400";

                return (
                  <button
                    key={ind.symbol}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedIndicator(ind.symbol)}
                    className={`rounded-2xl border p-4 text-left transition backdrop-blur-xl ${
                      isSelected
                        ? "border-blue-500/80 bg-blue-50/70 ring-2 ring-blue-500/30 dark:border-blue-400/80 dark:bg-blue-950/40"
                        : "border-zinc-200/80 bg-white/80 hover:border-zinc-300 hover:bg-white dark:border-white/10 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80"
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                      {ind.name}
                    </div>

                    <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-base font-black tracking-tight text-zinc-950 dark:text-white tabular-nums sm:text-lg">
                        {ind.price === null ? "—" : ind.unit === "Rp" ? rp(ind.price) : num(ind.price, ind.unit === "%" ? 3 : 2)}
                      </span>
                      {ind.price !== null && ind.unit !== "Rp" && (
                        <span className="text-[10px] font-semibold text-zinc-400">{ind.unit}</span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-1 text-[11px] font-bold tabular-nums">
                      <span className={changeColor}>
                        {ind.changePct === null ? "Perubahan —" : pct(ind.changePct)}
                      </span>
                    </div>

                    <div className="mt-2 text-[10px] text-zinc-600 dark:text-zinc-400">
                      {ind.status === "unavailable" ? "Data tidak tersedia" : ind.status === "stale" ? "Kutipan tersimpan" : "Kutipan penyedia"}
                      {ind.observedAt !== null && (
                        <time className="block" dateTime={new Date(ind.observedAt).toISOString()}>
                          {new Date(ind.observedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB
                        </time>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Indicator Detail Spotlight (Pengaruh Apa & Bagaimana) */}
            {activeInd && (
              <div className="mt-4 rounded-3xl border border-blue-200/80 bg-blue-50/50 p-5 backdrop-blur-xl dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 max-w-3xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-zinc-950 dark:text-white">
                        {activeInd.name} ({activeInd.symbol})
                      </span>
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                        {activeInd.status === "stale" ? "Kutipan tersimpan" : activeInd.impactBadge}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      <strong>Definisi:</strong> {activeInd.penjelasan}
                    </p>

                    <div className="rounded-2xl border border-blue-200/60 bg-white/80 p-3.5 dark:border-white/[0.06] dark:bg-zinc-900/80">
                      <div className="text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">
                        🎯 Apa Pengaruhnya Terhadap IHSG &amp; Bagaimana Mekanismenya?
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {activeInd.status === "stale" ? "Perbarui data untuk membaca dampak pergerakan terbaru." : activeInd.bagaimanaPengaruhnya}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 space-y-1.5 md:w-64">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Sektor Saham Terdampak:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeInd.sektorTerkait.map((sek) => (
                        <span
                          key={sek}
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {sek}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 2: Kalender Event Pengaruh IHSG Terdekat (MSCI & The Fed) ── */}
          <Card className="overflow-hidden p-0 border border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/70">
            <div className="border-b border-zinc-200/60 px-5 py-4 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">📅</span>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Kalender Event Pengaruh IHSG Terdekat (Katalis Pasar)
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Jadwal rebalancing indeks MSCI, rapat The Fed FOMC, rilis data inflasi US CPI, dan suku bunga BI-Rate
                </p>
              </div>

              {/* Event Category Filter */}
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100/90 p-1 dark:border-zinc-800 dark:bg-zinc-900/90">
                {[
                  { id: "ALL", label: "Semua" },
                  { id: "MSCI", label: "🌍 MSCI" },
                  { id: "THE_FED", label: "🏛️ The Fed" },
                  { id: "CPI_US", label: "📊 US CPI" },
                  { id: "BI_RATE", label: "🇮🇩 BI-Rate" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setEventFilter(tab.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      eventFilter === tab.id
                        ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white"
                        : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-zinc-200/60 dark:divide-white/[0.06]">
              {filteredNews.length === 0 && (
                <p role="status" className="p-5 text-sm text-zinc-600 dark:text-zinc-400">
                  {data.news.length ? "Belum ada artikel untuk kategori ini." : "Berita dari penerbit belum tersedia. Coba segarkan data."}
                </p>
              )}
              {filteredEvents.map((ev) => {
                const isUrgent = ev.countdownDays <= 7 && ev.countdownDays >= 0;

                return (
                  <div
                    key={ev.id}
                    className="p-5 transition hover:bg-zinc-50/90 dark:hover:bg-zinc-800/40 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-900 dark:bg-blue-950/70 dark:text-blue-300">
                          {ev.badge}
                        </span>
                        <h3 className="font-bold text-sm text-zinc-950 dark:text-white">
                          {ev.title}
                        </h3>
                        <span className="text-[11px] text-zinc-400">
                          Sumber: {ev.source}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          {new Date(ev.date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                          {ev.timeWib ? ` • ${ev.timeWib}` : ""}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                            isUrgent
                              ? "bg-rose-500 text-white animate-pulse"
                              : ev.countdownDays <= 14
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {ev.countdownDays === 0
                            ? "🔴 Hari Ini!"
                            : ev.countdownDays > 0
                            ? `⏳ ${ev.countdownDays} Hari Lagi`
                            : "Selesai"}
                        </span>
                      </div>
                    </div>

                    {/* Explanation Grid */}
                    <div className="grid gap-3 text-xs sm:grid-cols-2">
                      <div className="rounded-2xl border border-zinc-200/60 bg-zinc-50/70 p-3.5 dark:border-white/[0.05] dark:bg-zinc-800/40">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-1.5">
                          <span>💡</span> Pengaruh Langsung ke IHSG:
                        </div>
                        <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {ev.pengaruhKeIhsg}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-200/60 bg-zinc-50/70 p-3.5 dark:border-white/[0.05] dark:bg-zinc-800/40">
                        <div className="font-bold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
                          <span>🎯</span> Panduan Aksi Trader / Investor:
                        </div>
                        <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {ev.tipsAksiTrader}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 flex-wrap">
                      <span className="font-semibold">Sektor Fokus:</span>
                      {ev.sektorTerdampak.map((s) => (
                        <span
                          key={s}
                          className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}

              {filteredEvents.length === 0 && (
                <div className="p-8 text-center text-sm text-zinc-400">
                  Tidak ada event pada kategori ini.
                </div>
              )}
            </div>
          </Card>

          {/* ── Section 3: Pedoman Analisis Pengaruh Makro (Cheat Sheet) ── */}
          <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/50 space-y-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                <span>🧠</span> Matriks Pedoman: Skenario Makro &amp; Rotasi Sektor IHSG
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Panduan praktis menentukan saham pemenang saat rilis data The Fed, inflasi CPI, kurs Rupiah, atau MSCI
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {data.cheatSheet.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4 dark:border-white/[0.06] dark:bg-zinc-800/50 space-y-3"
                >
                  <div className="font-black text-sm text-zinc-900 dark:text-white border-b border-zinc-100 pb-2 dark:border-zinc-700">
                    {item.factor}
                  </div>

                  {/* Skenario A */}
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-rose-600 dark:text-rose-400">
                      ▲ {item.skenarioNaik.aksi}
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {item.skenarioNaik.dampakIhsg}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1 text-[10px]">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Diuntungkan:</span>
                      {item.skenarioNaik.sektorDiuntungkan.map((s) => (
                        <span key={s} className="rounded bg-emerald-50 px-1 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">{s}</span>
                      ))}
                    </div>
                  </div>

                  {/* Skenario B */}
                  <div className="text-xs space-y-1 pt-2 border-t border-zinc-100 dark:border-zinc-700/60">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      ▼ {item.skenarioTurun.aksi}
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {item.skenarioTurun.dampakIhsg}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1 text-[10px]">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Diuntungkan:</span>
                      {item.skenarioTurun.sektorDiuntungkan.map((s) => (
                        <span key={s} className="rounded bg-emerald-50 px-1 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 4: Live Financial News Feed (Multi-Source Aggregator) ── */}
          <Card className="overflow-hidden p-0 border border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/70">
            <div className="border-b border-zinc-200/60 px-5 py-4 dark:border-white/[0.06] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">📰</span>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Kilas Berita Makro &amp; Sentimen Terkini
                  </h2>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Agregasi multi-portal terverifikasi: CNBC Indonesia, Bisnis.com, Kontan, Reuters, Bloomberg, WSJ, Financial Times, &amp; Antara.
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100/90 p-1 dark:border-zinc-800 dark:bg-zinc-900/90 self-start sm:self-auto">
                <button
                  onClick={() => setNewsFilter("all")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    newsFilter === "all"
                      ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setNewsFilter("global")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    newsFilter === "global"
                      ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  The Fed / Global
                </button>
                <button
                  onClick={() => setNewsFilter("domestic")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    newsFilter === "domestic"
                      ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Domestik / BI
                </button>
              </div>
            </div>

            <div className="divide-y divide-zinc-200/60 dark:divide-white/[0.06]">
              {filteredNews.map((n) => (
                <a
                  key={n.id}
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-4 p-4 text-xs transition hover:bg-zinc-50/90 dark:hover:bg-zinc-800/40"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50">
                        <span>📰</span> {n.source}
                      </span>
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {n.tag}
                      </span>
                      {n.sentiment === "BULLISH" && (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          🟢 Sentimen Positif
                        </span>
                      )}
                      {n.sentiment === "BEARISH" && (
                        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          🔴 Sentimen Waspada
                        </span>
                      )}
                      <time dateTime={new Date(n.publishedAt).toISOString()} className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        {new Date(n.publishedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB
                      </time>
                    </div>
                    <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400">
                      {n.title}
                    </div>
                  </div>

                  <span className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0 text-base">
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

