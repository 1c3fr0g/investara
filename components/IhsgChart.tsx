"use client";

import { useEffect, useState } from "react";
import type { Ihsg } from "@/lib/types";
import { num } from "@/lib/format";

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 180;
  const h = 48;
  const pad = 4;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const stroke = up ? "#16a34a" : "#dc2626";
  const fill = up ? "rgba(22, 163, 74, 0.12)" : "rgba(220, 38, 38, 0.12)";
  const area = `${pts.join(" ")} ${w - pad},${h} ${pad},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full overflow-visible" aria-hidden="true">
      <polygon points={area} fill={fill} />
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Menghitung status sesi perdagangan BEI berdasarkan waktu WIB (UTC+7)
function getWibMarketState(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour12: false,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const day = getPart("weekday"); // Mon, Tue, Wed, Thu, Fri, Sat, Sun
  const h = parseInt(getPart("hour"), 10) || 0;
  const m = parseInt(getPart("minute"), 10) || 0;
  const s = parseInt(getPart("second"), 10) || 0;

  const totalMin = h * 60 + m;
  const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} WIB`;

  const isWeekend = day === "Sat" || day === "Sun";
  const isFriday = day === "Fri";

  let status = "🔴 PASAR TUTUP";
  let badgeCls = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800";
  let detail = "Pasar buka kembali pada hari kerja pukul 09:00 WIB";
  let isOpen = false;

  if (!isWeekend) {
    if (totalMin >= 8 * 60 + 45 && totalMin < 9 * 60) {
      status = "🟡 PRA-PEMBUKAAN";
      badgeCls = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      detail = "Pre-Opening (08:45 - 08:59 WIB). Sesi I mulai 09:00 WIB";
    } else if (isFriday) {
      // Jumat schedule
      if (totalMin >= 9 * 60 && totalMin < 11 * 60 + 30) {
        status = "🟢 PASAR BUKA (SESI I)";
        badgeCls = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
        detail = "Sesi I Jumat berlangsung (09:00 - 11:30 WIB)";
        isOpen = true;
      } else if (totalMin >= 11 * 60 + 30 && totalMin < 14 * 60) {
        status = "⏸️ ISTIRAHAT SIANG";
        badgeCls = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800";
        detail = "Istirahat Sholat Jumat. Sesi II dibuka pukul 14:00 WIB";
      } else if (totalMin >= 14 * 60 && totalMin < 15 * 60 + 49) {
        status = "🟢 PASAR BUKA (SESI II)";
        badgeCls = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
        detail = "Sesi II Jumat berlangsung (14:00 - 15:49 WIB)";
        isOpen = true;
      } else if (totalMin >= 15 * 60 + 50 && totalMin <= 16 * 60) {
        status = "🟡 PRA-PENUTUPAN";
        badgeCls = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800";
        detail = "Pre-Closing (15:50 - 16:00 WIB)";
      } else if (totalMin > 16 * 60 && totalMin <= 16 * 60 + 15) {
        status = "⏳ PASCA-PENUTUPAN";
        badgeCls = "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700";
        detail = "Post-Trading (16:05 - 16:15 WIB)";
      } else if (totalMin < 8 * 60 + 45) {
        status = "🔴 PASAR TUTUP";
        detail = "Pasar akan buka pukul 08:45 WIB (Pre-Opening)";
      } else {
        status = "🔴 PASAR TUTUP";
        detail = "Perdagangan hari ini selesai. Buka kembali Senin 09:00 WIB";
      }
    } else {
      // Senin - Kamis schedule
      if (totalMin >= 9 * 60 && totalMin < 12 * 60) {
        status = "🟢 PASAR BUKA (SESI I)";
        badgeCls = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
        detail = "Sesi I berlangsung (09:00 - 12:00 WIB)";
        isOpen = true;
      } else if (totalMin >= 12 * 60 && totalMin < 13 * 60 + 30) {
        status = "⏸️ ISTIRAHAT SIANG";
        badgeCls = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800";
        detail = "Istirahat Sesi I. Sesi II dibuka pukul 13:30 WIB";
      } else if (totalMin >= 13 * 60 + 30 && totalMin < 15 * 60 + 49) {
        status = "🟢 PASAR BUKA (SESI II)";
        badgeCls = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
        detail = "Sesi II berlangsung (13:30 - 15:49 WIB)";
        isOpen = true;
      } else if (totalMin >= 15 * 60 + 50 && totalMin <= 16 * 60) {
        status = "🟡 PRA-PENUTUPAN";
        badgeCls = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800";
        detail = "Pre-Closing (15:50 - 16:00 WIB)";
      } else if (totalMin > 16 * 60 && totalMin <= 16 * 60 + 15) {
        status = "⏳ PASCA-PENUTUPAN";
        badgeCls = "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700";
        detail = "Post-Trading (16:05 - 16:15 WIB)";
      } else if (totalMin < 8 * 60 + 45) {
        status = "🔴 PASAR TUTUP";
        detail = "Pasar akan buka pukul 08:45 WIB (Pre-Opening)";
      } else {
        status = "🔴 PASAR TUTUP";
        detail = "Perdagangan hari ini selesai. Buka kembali besok 09:00 WIB";
      }
    }
  }

  return { timeStr, status, badgeCls, detail, isOpen };
}

const DEFAULT_MARKET_STATE = {
  timeStr: "--:--:-- WIB",
  status: "⏳ MEMERIKSA...",
  badgeCls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
  detail: "Memeriksa status perdagangan bursa BEI...",
  isOpen: false,
};

export function IhsgChart() {
  const [d, setD] = useState<Ihsg | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [marketInfo, setMarketInfo] = useState(DEFAULT_MARKET_STATE);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/ihsg", { signal: ctrl.signal });
        if (!response.ok) throw new Error("Gagal memuat IHSG");
        const quote: Ihsg = await response.json();
        if (ctrl.signal.aborted) return;
        setD(quote);
        setQuoteFailed(quote.harga == null);
      } catch {
        if (!ctrl.signal.aborted) setQuoteFailed(true);
      }
    };
    load();
    const t = setInterval(() => !document.hidden && load(), 60_000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
  }, []);

  // Update clock every second (client-only after mount)
  useEffect(() => {
    const timer = setInterval(() => {
      setMarketInfo(getWibMarketState(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const change = d?.perubahan;
  const changePct = d?.perubahan_pct;
  const up = (change ?? changePct ?? 0) >= 0;
  const sign = up ? "+" : "−";
  const tone = up ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300";

  return (
    <section aria-labelledby="ihsg-quote-title" className="screen-shell pt-6">
      <div className="ios-glass-canvas crystal-hero rounded-[1.75rem] p-4 sm:p-6">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-center lg:gap-6">
          <div className="flex min-w-0 items-center justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <h2 id="ihsg-quote-title" className="text-sm font-semibold tracking-tight text-foreground">
                IHSG <span className="font-normal text-slate-600 dark:text-slate-300">· Indeks Harga Saham Gabungan</span>
              </h2>

              {d?.harga != null ? (
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                    <span className="text-4xl font-bold leading-none tracking-[-0.055em] text-foreground tabular-nums sm:text-5xl">
                      {num(d.harga, 2)}
                    </span>
                    {(change != null || changePct != null) && (
                      <span className={`ios-glass-card rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums sm:text-sm ${tone}`}>
                        {change != null && sign + num(Math.abs(change), 2)}
                        {changePct != null && (
                          change == null
                            ? `${sign}${num(Math.abs(changePct), 2)}%`
                            : ` (${sign}${num(Math.abs(changePct), 2)}%)`
                        )}
                      </span>
                    )}
                  </div>
                  {d.waktu && (
                    <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(d.waktu).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB
                    </p>
                  )}
                </div>
              ) : (
                <p role="status" className="py-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  {quoteFailed ? "Harga IHSG belum tersedia" : "Memuat harga IHSG…"}
                </p>
              )}
            </div>

            {d && d.seri.length > 1 && (
              <div className="hidden w-32 shrink-0 sm:block xl:w-44">
                <Sparkline data={d.seri} up={up} />
                <span className="block text-right text-[10px] text-zinc-400 pt-1">Tren 45 hari terakhir</span>
              </div>
            )}
          </div>

          <div className="ios-glass-subtle rounded-[1.25rem] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Status pasar BEI
              </span>
              <span className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {marketInfo.timeStr}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span
                className={`inline-flex items-center rounded-xl border px-3.5 py-1.5 text-xs font-extrabold shadow-2xs ${marketInfo.badgeCls}`}
              >
                {marketInfo.status}
              </span>
              <button
                type="button"
                aria-expanded={showSchedule}
                aria-controls="ihsg-market-schedule"
                onClick={() => setShowSchedule((open) => !open)}
                className="ios-glass-pill min-h-9 rounded-full px-3 text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                {showSchedule ? "Tutup Jadwal ▲" : "Lihat Jadwal ▼"}
              </button>
            </div>

            <p className="mt-2 hidden text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 sm:block">
              {marketInfo.detail}
            </p>

            <div id="ihsg-market-schedule" hidden={!showSchedule} className="mt-3 overflow-hidden rounded-xl">
              <table className="w-full text-left text-[11px] tabular-nums text-slate-700 dark:text-slate-200">
                <caption className="sr-only">Jadwal sesi perdagangan BEI dalam WIB</caption>
                <thead>
                  <tr>
                    <th scope="col" className="px-2 py-1.5">Hari</th>
                    <th scope="col" className="px-1 py-1.5">Sesi I</th>
                    <th scope="col" className="px-1 py-1.5">Sesi II</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                  <tr>
                    <th scope="row" className="px-2 py-1.5 font-medium">Senin – Kamis</th>
                    <td className="px-1 py-1.5">09:00 – 12:00</td>
                    <td className="px-1 py-1.5">13:30 – 15:49</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2 py-1.5 font-medium">Jumat</th>
                    <td className="px-1 py-1.5">09:00 – 11:30</td>
                    <td className="px-1 py-1.5">14:00 – 15:49</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-2 py-1.5 font-medium">Sabtu, Minggu &amp; hari libur</th>
                    <td colSpan={2} className="px-1 py-1.5 font-semibold text-rose-800 dark:text-rose-300">Pasar tutup</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
