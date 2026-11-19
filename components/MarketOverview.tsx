"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ListItem, PasarResponse } from "@/lib/types";
import { compact, num, rp } from "@/lib/format";
import { Card } from "./ui";
import { StockLogo } from "./StockLogo";
import { MacroDashboard } from "./MacroDashboard";

function MoverTable({
  title,
  note,
  rows,
  mode,
}: {
  title: string;
  note?: string;
  rows: ListItem[];
  mode: "chg" | "nilai" | "foreign";
}) {
  return (
    <Card className="overflow-hidden p-0 shadow-xs border border-zinc-200/80 bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#141821]/75">
      <div className="border-b border-zinc-200/70 bg-zinc-50/50 px-5 py-4 dark:border-white/[0.06] dark:bg-zinc-800/30">
        <h2 className="font-bold text-zinc-950 dark:text-zinc-100 text-base">{title}</h2>
        {note && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{note}</p>}
      </div>
      <div role="region" aria-label={title} tabIndex={0} className="table-scroll focus-visible:-outline-offset-2">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {rows.map((s, i) => {
              const up = (s.perubahan_pct ?? 0) >= 0;
              const flowUp = (s.foreign_flow ?? 0) >= 0;
              return (
                <tr key={s.kode} className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                  <td className="w-10 px-4 py-3.5 text-center text-xs font-semibold text-zinc-400 dark:text-zinc-500">{i + 1}</td>
                  <td className="py-3.5 px-2">
                    <div className="flex items-center gap-3">
                      <StockLogo kode={s.kode} size="xs" />
                      <div>
                        <Link href={`/saham/${s.kode}`} className="font-bold text-green-700 hover:underline dark:text-green-400 text-sm">
                          {s.kode}
                        </Link>
                        <div className="max-w-[130px] truncate text-xs text-zinc-500 dark:text-zinc-400 xl:max-w-[160px]">{s.nama}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">{rp(s.harga)}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-bold tabular-nums">
                    {mode === "nilai" ? (
                      <div>
                        <span className="text-zinc-950 dark:text-zinc-100 font-bold">{compact(s.nilai)}</span>
                        <div className={`text-xs font-semibold ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {s.perubahan_pct === null ? "-" : `${up ? "▲" : "▼"} ${num(Math.abs(s.perubahan_pct), 2)}%`}
                        </div>
                      </div>
                    ) : mode === "foreign" ? (
                      <div>
                        <span className={`font-bold ${flowUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {flowUp ? "+" : ""}{compact(s.foreign_flow)}
                        </span>
                        <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                          {s.foreign_status || "Netral"}
                        </div>
                      </div>
                    ) : (
                      <span className={up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {s.perubahan_pct === null ? "-" : `${up ? "▲" : "▼"} ${num(Math.abs(s.perubahan_pct), 2)}%`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function MarketOverview() {
  const sp = useSearchParams();
  const router = useRouter();
  const currentTab = sp.get("tab") === "makro" ? "makro" : "movers";

  const setTab = (tab: "movers" | "makro") => {
    const params = new URLSearchParams(sp.toString());
    if (tab === "movers") params.delete("tab");
    else params.set("tab", "makro");
    router.replace(`/pasar?${params.toString()}`, { scroll: false });
  };

  const [state, setState] = useState<{ data?: PasarResponse; error?: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load(force: boolean) {
    setRefreshing(true);
    try {
      const r = await fetch(`/api/pasar${force ? "?refresh=1" : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Gagal mengambil data");
      setState({ data: j });
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  const d = state?.data;
  const maxAbs = d ? Math.max(1, ...d.sektor.map((s) => Math.abs(s.perubahan_pct ?? 0))) : 1;

  return (
    <main className="screen-shell space-y-8 screen-section">
      {/* ── Segmented Tab Control: Top Movers vs Makro Global & Kalender ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-200/80 bg-zinc-100/90 p-1.5 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/80">
          <button
            onClick={() => setTab("movers")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              currentTab === "movers"
                ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <span>📊</span>
            <span>Top Movers &amp; Sektor IHSG</span>
          </button>

          <button
            onClick={() => setTab("makro")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              currentTab === "makro"
                ? "bg-white text-blue-900 shadow-xs dark:bg-zinc-800 dark:text-blue-300"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <span>🌐</span>
            <span>Makro Global, The Fed &amp; Kalender Event</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.2 text-[10px] font-extrabold text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
              MSCI &amp; CPI
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/pasar/heatmap"
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 shadow-xs transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            🗺️ Buka Peta Panas (Heatmap) →
          </Link>
        </div>
      </div>

      {currentTab === "makro" ? (
        <MacroDashboard />
      ) : (
        <>
          <div className="crystal-intro flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="crystal-title">Pasar &amp; Top Movers</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Performa per sektor industri dan saham dengan pergerakan harga/nilai terbesar hari ini.
              </p>
              {d && (
                <p className="text-xs text-zinc-400 pt-0.5">
                  Data terakhir diperbarui: {new Date(d.updatedAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "medium" })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-green-700 disabled:opacity-60"
              >
                {refreshing ? "Memuat..." : "↻ Refresh"}
              </button>
            </div>
          </div>

      {!d && !state?.error && (
        <div className="py-20 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-green-600 dark:border-zinc-800 dark:border-t-green-400" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Memuat data pasar...</p>
        </div>
      )}
      {state?.error && <Card className="p-6 text-sm text-red-600">Gagal memuat data: {state.error}</Card>}

      {d && (
        <>
          <Card className="p-6 sm:p-7">
            <h2 className="mb-1 font-bold text-base text-zinc-950 dark:text-zinc-100">Performa Sektor Hari Ini (IDX-IC)</h2>
            <p className="mb-5 text-xs text-zinc-500 dark:text-zinc-400">
              Rata-rata perubahan harga berbobot market cap. Klik sektor untuk menyaring saham di screener.
            </p>
            <div className="space-y-2.5">
              {d.sektor.map((s) => {
                const v = s.perubahan_pct ?? 0;
                const up = v >= 0;
                return (
                  <Link
                    key={s.nama}
                    href={`/?grup=${encodeURIComponent(`sek:${s.nama}`)}`}
                    className="grid grid-cols-[minmax(120px,220px)_1fr_auto] items-center gap-4 rounded-xl px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  >
                    <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{s.nama}</span>
                    <div className="relative h-6 bg-zinc-100 dark:bg-zinc-800/70 rounded-full overflow-hidden">
                      <div className="absolute left-1/2 top-0 h-full w-px bg-zinc-300 dark:bg-zinc-700 z-10" />
                      <div
                        className={`absolute top-0 h-full transition-all ${up ? "left-1/2 bg-emerald-500 rounded-r" : "right-1/2 bg-rose-500 rounded-l"}`}
                        style={{ width: `${(Math.abs(v) / maxAbs) * 50}%` }}
                      />
                    </div>
                    <span className="w-44 text-right text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                      <strong className={`font-bold ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {up ? "▲" : "▼"} {num(Math.abs(v), 2)}%
                      </strong>{" "}
                      · {s.naik} naik / {s.turun} turun
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Foreign Flow / Smart Money Section */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-100">
                    🌊 Arus Dana Asing &amp; Smart Money (Foreign Flow)
                  </h2>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Live Inflow &amp; CMF
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Estimasi arus akumulasi dan distribusi modal institusi / asing berdasarkan Chaikin Money Flow dan transaksi bursa.
                </p>
              </div>

              {d.foreignSummary && (
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-2 text-right shadow-xs backdrop-blur-md dark:border-white/[0.08] dark:bg-[#141821]/75">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Total Net Asing IDX
                    </span>
                    <span
                      className={`text-sm font-black tabular-nums ${
                        d.foreignSummary.netTotal >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {d.foreignSummary.netTotal >= 0 ? "+" : ""}
                      {compact(d.foreignSummary.netTotal)}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-2 text-right shadow-xs backdrop-blur-md dark:border-white/[0.08] dark:bg-[#141821]/75">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Sentimen Smart Money
                    </span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {d.foreignSummary.sentiment}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <MoverTable
                title="Top Akumulasi Asing (Net Buy)"
                note="Saham dengan estimasi aliran dana masuk asing/institusi terbesar hari ini"
                rows={d.foreignTopBuy ?? []}
                mode="foreign"
              />
              <MoverTable
                title="Top Distribusi Asing (Net Sell)"
                note="Saham dengan estimasi pelepasan/aliran keluar dana asing terbesar hari ini"
                rows={d.foreignTopSell ?? []}
                mode="foreign"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <MoverTable title="Top Gainers" note="Kenaikan harga tertinggi (nilai transaksi ≥ Rp1 M)" rows={d.naik} mode="chg" />
            <MoverTable title="Top Losers" note="Penurunan harga terdalam (nilai transaksi ≥ Rp1 M)" rows={d.turun} mode="chg" />
            <MoverTable title="Top Value" note="Nilai transaksi harian terbesar" rows={d.nilai} mode="nilai" />
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed pt-2">
            Sumber: Yahoo Finance dan TradingView (tertunda 10–15 menit). Perhitungan Foreign Flow dianalisis dari data volume bobot harga, CMF (Chaikin Money Flow), dan transaksi pasar harian.
          </p>
        </>
      )}
    </>
  )}
</main>
  );
}
