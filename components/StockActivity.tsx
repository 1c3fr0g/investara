"use client";

import { useEffect, useState } from "react";
import { compact, num, pct } from "@/lib/format";
import { completedMoneyFlow, type BrokerActivity, type InsiderReport } from "@/lib/stockActivity";
import type { GrossBroker } from "@/lib/publicStockActivity";
import type { StockActivityResult } from "@/lib/stockActivityProvider";
import { Card, Stat } from "./ui";

const ANNOUNCEMENTS = "https://www.idx.co.id/id/berita/pengumuman/";
const BROKERS = "https://www.idx.co.id/id/data-pasar/ringkasan-perdagangan/ringkasan-broker";
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" });
const caption = "text-sm text-zinc-600 dark:text-zinc-400";
const control = "control-button ios-glass-pill rounded-xl px-3 text-sm font-semibold";

function dateLabel(date: string) {
  return dateFormat.format(new Date(date + "T00:00:00Z"));
}

function signed(value: number, format: (value: number) => string) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${format(Math.abs(value))}`;
}

function BrokerTable({ title, rows }: { title: string; rows: BrokerActivity[] }) {
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="font-semibold">{title}</h3>
      {rows.length === 0 ? <p className={caption}>Tidak ada broker di sisi ini.</p> : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((row) => (
          <li key={row.code} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 text-sm wrap-anywhere"><strong>{row.code}</strong> <span className={caption}>{row.name === row.code ? "" : row.name}</span></p>
                <strong className={row.netValue > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}>{signed(row.netValue, compact)}</strong>
              </div>
              <p className={caption}>
                Volume net {signed(row.netShares, (n) => num(n, 0))} saham · Rata-rata beli {row.buyAverage === null ? "—" : `Rp ${num(row.buyAverage)}`} · Jual {row.sellAverage === null ? "—" : `Rp ${num(row.sellAverage)}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GrossBrokerTable({ title, rows }: { title: string; rows: GrossBroker[] }) {
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="font-semibold">{title}</h3>
      {rows.length === 0 ? <p className={caption}>Data sisi ini belum tersedia.</p> : (
        <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {rows.map((row) => (
            <li key={row.code} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 wrap-anywhere"><strong>{row.code}</strong> <span className={caption}>{row.name}</span></p>
                <strong>{compact(row.value)}</strong>
              </div>
              <p className={caption}>{num(row.lots, 0)} lot{row.average !== null && ` · Rata-rata Rp ${num(row.average)}`}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InsiderCard({ report }: { report: InsiderReport }) {
  const holding = (shares: number | null, percent: number | null) => `${shares === null ? "—" : `${num(shares, 0)} saham`}${percent === null ? "" : ` (${pct(percent, 4)})`}`;
  return (
    <li className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 text-sm font-semibold wrap-anywhere">{report.name} {report.role && <span className={caption}>· {report.role}</span>}</h3>
        <p className={caption}>Laporan {dateLabel(report.published)}</p>
      </div>
      <p className={caption}>Kepemilikan {holding(report.before, report.beforePct)} → {holding(report.after, report.afterPct)}</p>
      {report.document && <a href={report.document.url} target="_blank" rel="noreferrer" className={`${caption} underline`}>Dokumen BEI {report.document.number} ↗</a>}
      {report.purpose && <p className={caption}>Tujuan laporan: {report.purpose}</p>}
      {report.transactions.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {report.transactions.map((transaction, index) => (
            <li key={index}>
              <strong>{transaction.type === "Buy" ? "Beli" : transaction.type === "Sell" ? "Jual" : transaction.type}</strong>
              {transaction.date && ` · ${dateLabel(transaction.date)}`}
              {transaction.shares !== null && ` · ${num(transaction.shares, 0)} saham`}
              {transaction.price !== null && ` · Rp ${num(transaction.price)} per saham`}
            </li>
          ))}
        </ul>
      ) : <p className={caption}>Rincian transaksi tidak disertakan dalam data laporan.</p>}
    </li>
  );
}

function MoneyFlow({ kode }: { kode: string }) {
  const [state, setState] = useState<{ value: ReturnType<typeof completedMoneyFlow>; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/saham/${kode}/chart?interval=1d`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const { candles }: { candles: Parameters<typeof completedMoneyFlow>[0] } = await response.json();
        if (!controller.signal.aborted) setState({ value: completedMoneyFlow(candles), failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ value: null, failed: true });
      });
    return () => controller.abort();
  }, [kode, attempt]);

  return (
    <div className="space-y-1 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800/70">
      <p className="text-sm font-semibold">Tekanan harga dan volume · CMF 20</p>
      {state ? state.value ? (
        <p className={caption}><strong>{num(state.value.value, 3)}</strong> · per {dateLabel(state.value.date)}</p>
      ) : state.failed ? (
        <p className={caption}>Riwayat harga gagal dimuat. <button type="button" className="underline" onClick={() => { setState(null); setAttempt((previous) => previous + 1); }}>Coba lagi</button></p>
      ) : <p className={caption}>Data 20 sesi selesai belum mencukupi.</p> : <p role="status" className={caption}>Memuat data harga dan volume…</p>}
      <p className={caption}>Indikator dari harga dan volume harian Yahoo Finance. Nilai positif menunjukkan tekanan beli relatif dan nilai negatif menunjukkan tekanan jual relatif. Identitas broker tidak bisa ditentukan dari indikator ini.</p>
    </div>
  );
}

function ActivityFeed({ kode, view }: { kode: string; view: "broker" | "insider" }) {
  const [days, setDays] = useState(view === "broker" ? 7 : 90);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<StockActivityResult | "error" | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/saham/${kode}/aktivitas?view=${view}&days=${days}&page=${page}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data: StockActivityResult = await response.json();
        if (!controller.signal.aborted) setResult(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult("error");
      });
    return () => controller.abort();
  }, [kode, view, days, page, attempt]);

  const failed = result === "error" || result?.status === "unavailable";
  const unavailable = result && result !== "error" && (result.status === "restricted" || result.status === "unconfigured");
  const foreign = result && result !== "error" && result.status !== "ready" ? result.foreign : null;
  const source = result && result !== "error" && result.status === "ready" ? result.source : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          {view === "broker" ? "Periode perdagangan" : "Periode laporan"}
          <select value={days} onChange={(event) => { setResult(null); setPage(1); setDays(Number(event.target.value)); }} className={control}>
            {[7, 30, 90].map((day) => <option key={day} value={day}>{day} hari</option>)}
          </select>
        </label>
        {result && result !== "error" && <p className={caption}>{dateLabel(result.from)} – {dateLabel(result.to)} (WIB)</p>}
      </div>
      {result === null && <p role="status" className={caption}>Memuat data {view === "broker" ? "broker" : "insider"}…</p>}
      {(failed || unavailable) && (
        <p role="status" className={caption}>
          {view === "broker" ? "Peringkat broker belum tersedia untuk periode ini." : "Riwayat insider otomatis belum tersedia untuk periode ini."}{" "}
          {(view === "broker" || failed) && <button type="button" className="underline" onClick={() => { setResult(null); setAttempt((n) => n + 1); }}>Coba lagi</button>}
        </p>
      )}
      {foreign && result && result !== "error" && (
        <div className="space-y-1 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800/70">
          <p className="text-sm font-semibold">Arus asing {kode} · {dateLabel(foreign.date)}</p>
          <p className={caption}><strong>{signed(foreign.netValue, compact)}</strong>{foreign.stale && " · arsip sumber"}{foreign.date < result.from && " · di luar periode terpilih"}</p>
          <p className={caption}>Nilai bersih satu sesi dari IPOT melalui Midori Research.</p>
        </div>
      )}
      {result && result !== "error" && result.status === "ready" && (result.view === "broker" ? (
        result.source === "ipot" ? (
          <>
            <p className={caption}>IPOT melalui Midori Research · broker teratas menurut lot · angka bisa dibulatkan sumber{result.data.stale && " · arsip sumber"}</p>
            <div className="grid gap-5 lg:grid-cols-2">
              <GrossBrokerTable title="Pembeli terbesar (bruto)" rows={result.data.buyers} />
              <GrossBrokerTable title="Penjual terbesar (bruto)" rows={result.data.sellers} />
            </div>
          </>
        ) :
        result.data.count === 0 ? <p className={caption}>Penyedia tidak mengembalikan data broker pada periode ini.</p> : (
          <div className="grid gap-5 lg:grid-cols-2">
            <BrokerTable title="Top Net Buy" rows={result.data.buyers} />
            <BrokerTable title="Top Net Sell" rows={result.data.sellers} />
          </div>
        )
      ) : (
        <>
          {result.source === "idx-archive" && <p className={caption}>Cuplikan laporan resmi BEI yang sudah diverifikasi. Cakupan arsip terbatas.</p>}
          {result.data.reports.length === 0 ? <p className={caption}>Tidak ada laporan yang dikembalikan untuk emiten ini pada halaman tersebut.</p> : (
            <ul className="space-y-2">{result.data.reports.map((report, index) => <InsiderCard key={`${report.published}-${report.name}-${index}`} report={report} />)}</ul>
          )}
          {(page > 1 || result.data.nextPage !== null) && (
            <nav aria-label="Halaman laporan insider" className="flex flex-wrap items-center gap-2 text-sm">
              <button type="button" className={control} disabled={page === 1} onClick={() => { setResult(null); setPage(page - 1); }}>Sebelumnya</button>
              <span>Halaman {page}</span>
              <button type="button" className={control} disabled={result.data.nextPage === null || page >= 100} onClick={() => { setResult(null); setPage(page + 1); }}>Berikutnya</button>
            </nav>
          )}
        </>
      ))}
      {view === "broker" ? (
        <p className={caption}>{source === "invezgo" && "Sumber net broker: Invezgo, pasar reguler, seluruh investor. "}<a href={`https://www.indopremier.com/ipotnews/newsSmartSearch.php?code=${kode}`} target="_blank" rel="noreferrer" className="underline">Buka {kode} di IPOT ↗</a>{" · "}<a href={BROKERS} target="_blank" rel="noreferrer" className="underline">Ringkasan broker BEI ↗</a></p>
      ) : (
        <p className={caption}>{source === "invezgo" && "Sumber: Invezgo berdasarkan keterbukaan emiten. "}<a href={ANNOUNCEMENTS} target="_blank" rel="noreferrer" className="underline">Cari {kode} di Pengumuman BEI ↗</a></p>
      )}
    </div>
  );
}

export function StockActivity({ kode, insiderPct }: { kode: string; insiderPct: number | null }) {
  const [view, setView] = useState<"broker" | "insider" | null>(null);
  return (
    <section id="aktivitas-saham" aria-labelledby="aktivitas-saham-title" className="scroll-mt-28">
      <Card className="space-y-4 p-4 sm:p-6">
        <div>
          <h2 id="aktivitas-saham-title" className="text-lg font-bold">Bandarmology dan Insider</h2>
          <p className={caption}>Pantau aktivitas broker dan perubahan kepemilikan yang dilaporkan untuk {kode}.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Jenis aktivitas saham">
          <button type="button" className={`${control} aria-pressed:ring-2 aria-pressed:ring-emerald-600`} aria-pressed={view === "broker"} aria-controls="aktivitas-saham-panel" onClick={() => setView("broker")}>Bandarmology</button>
          <button type="button" className={`${control} aria-pressed:ring-2 aria-pressed:ring-emerald-600`} aria-pressed={view === "insider"} aria-controls="aktivitas-saham-panel" onClick={() => setView("insider")}>Insider</button>
        </div>
        <div id="aktivitas-saham-panel" className="min-w-0 space-y-4">
          {view === "broker" && <MoneyFlow kode={kode} />}
          {view === "insider" && <Stat label="Porsi insider · Yahoo Finance" value={insiderPct === null ? "Belum tersedia" : pct(insiderPct, 2)} />}
          {view && <ActivityFeed key={`${kode}-${view}`} kode={kode} view={view} />}
        </div>
      </Card>
    </section>
  );
}
