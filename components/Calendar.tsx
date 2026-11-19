"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { KalenderItem } from "@/lib/types";
import { pct, rp } from "@/lib/format";
import { Card } from "./ui";
import { StarButton, useWatchlist } from "./Watchlist";
import { StockLogo } from "./StockLogo";

type Filter = "semua" | "pasti" | "perkiraan" | "lalu";
const TABS: { id: Filter; label: string }[] = [
  { id: "semua", label: "Semua" },
  { id: "pasti", label: "Terjadwal" },
  { id: "perkiraan", label: "Perkiraan" },
  { id: "lalu", label: "Baru lewat" },
];
const BADGE: Record<KalenderItem["jenis"], { text: string; cls: string }> = {
  pasti: { text: "Terjadwal", cls: "bg-emerald-600 text-white" },
  perkiraan: { text: "Perkiraan", cls: "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  lalu: { text: "Sudah ex-date", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

const tgl = (t: number | null) => (t === null ? "-" : new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }));
const bulan = (t: number) => new Date(t).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

type CalendarResult =
  | { requestKey: string; items: KalenderItem[] }
  | { requestKey: string; error: true };

export function Calendar() {
  const { status } = useSession();
  const { list: watch } = useWatchlist();
  const [result, setResult] = useState<CalendarResult | null>(null);
  const [hari, setHari] = useState(90);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<Filter>("semua");
  const [mine, setMine] = useState(false);
  const [lots, setLots] = useState<Record<string, number>>({});
  const allStatusesRef = useRef<HTMLButtonElement>(null);
  const requestKey = `${hari}:${retry}`;
  const current = result?.requestKey === requestKey ? result : null;
  const items = current && "items" in current ? current.items : null;
  const error = current && "error" in current;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/kalender?hari=${hari}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Gagal mengambil data");
        const { items }: { items: KalenderItem[] } = await r.json();
        if (!ctrl.signal.aborted) setResult({ requestKey, items });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ requestKey, error: true });
      });
    return () => ctrl.abort();
  }, [hari, requestKey]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/portofolio")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items: { kode: string; lot: number }[] }) => {
        const m: Record<string, number> = {};
        for (const h of j.items) m[h.kode] = (m[h.kode] ?? 0) + h.lot;
        setLots(m);
      })
      .catch(() => {});
  }, [status]);

  const authed = status === "authenticated";
  const onlyMine = authed && mine;
  const hasFilters = filter !== "semua" || onlyMine;
  const mineSet = useMemo(() => new Set([...Object.keys(lots), ...watch]), [lots, watch]);
  const shown = (items ?? []).filter((i) =>
    (filter === "semua" || i.jenis === filter) && (!onlyMine || mineSet.has(i.kode)),
  );
  const resultCount = shown.length.toLocaleString("id-ID") + " jadwal dividen";
  const emptyMessage = items?.length
    ? "Tidak ada jadwal dividen yang cocok dengan filter."
    : "Tidak ada jadwal dividen pada periode ini.";
  const progressMessage = "Memuat kalender dividen...";
  const grouped = new Map<string, KalenderItem[]>();
  for (const item of shown) {
    const month = bulan(item.ex);
    const rows = grouped.get(month);
    if (rows) rows.push(item);
    else grouped.set(month, [item]);
  }

  const tabCls = (a: boolean) =>
    `min-h-11 cursor-pointer rounded-xl border px-3 text-sm font-semibold motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--glass-focus)] ${
      a
        ? "crystal-active border-transparent"
        : "ios-glass-pill text-slate-700 dark:text-slate-200"
    }`;

  return (
    <main className="screen-shell space-y-6 screen-section">
      <header className="crystal-intro space-y-2">
        <h1 className="crystal-title">Kalender Dividen Saham</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Lihat ex-date dan tanggal pembayaran untuk jadwal resmi dan perkiraan.
        </p>
      </header>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-semibold">Status jadwal</legend>
            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  ref={t.id === "semua" ? allStatusesRef : undefined}
                  type="button"
                  aria-pressed={filter === t.id}
                  className={tabCls(filter === t.id)}
                  onClick={() => setFilter(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-semibold">Periode ke depan</legend>
            <div className="flex flex-wrap gap-2">
              {[30, 90, 180].map((h) => (
                <button type="button" key={h} aria-pressed={hari === h} className={tabCls(hari === h)} onClick={() => {
                  if (hari === h) return;
                  setHari(h);
                  setRetry((value) => value + 1);
                }}>
                  {h} hari
                </button>
              ))}
            </div>
          </fieldset>
          {authed && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setMine(e.target.checked)} className="size-4 accent-emerald-600" />
              Hanya portofolio &amp; watchlist
            </label>
          )}
        </div>
        <p role="status" className="sr-only">
          {error ? "" : !items ? progressMessage : shown.length ? resultCount : emptyMessage}
        </p>
      </Card>

      {error && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">Kalender dividen gagal dimuat.</p>
          <button type="button" className={tabCls(false)} onClick={() => setRetry((value) => value + 1)}>Coba lagi</button>
        </Card>
      )}
      {!items && !error && (
        <div className="py-16 text-center">
          <div aria-hidden="true" className="mx-auto mb-4 size-8 rounded-full border-4 border-zinc-200 border-t-emerald-600 motion-safe:animate-spin dark:border-zinc-800 dark:border-t-emerald-400" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{progressMessage}</p>
        </div>
      )}
      {items && shown.length > 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{resultCount}</p>
      )}
      {items && shown.length === 0 && (
        <Card className="space-y-3 p-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <p>{emptyMessage}</p>
          {hasFilters && items.length > 0 && (
            <button type="button" className={tabCls(false)} onClick={() => {
              setFilter("semua");
              setMine(false);
              allStatusesRef.current?.focus();
            }}>Hapus filter</button>
          )}
        </Card>
      )}

      {Array.from(grouped, ([nama, rows]) => (
        <Card key={nama} className="overflow-hidden p-0 shadow-xs">
          <h2 className="border-b border-zinc-200/80 bg-zinc-50/80 px-5 py-3.5 text-sm font-bold capitalize text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-100">
            {nama}
          </h2>
          <div className="table-scroll">
            <table className="w-full text-sm">
              <caption className="sr-only">Jadwal dividen {nama}</caption>
              <thead className="border-b border-zinc-200/80 text-left text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th scope="col" className="px-3 py-2.5 sm:px-5">Emiten</th>
                  <th scope="col" className="px-2 py-2.5 sm:px-4">
                    Ex-date<span className="md:hidden"> / Bayar</span>
                  </th>
                  <th scope="col" className="hidden px-4 py-2.5 text-right md:table-cell">Harga saham</th>
                  <th scope="col" className="px-3 py-2.5 text-right sm:px-5">Yield</th>
                  <th scope="col" className="hidden px-5 py-2.5 text-right md:table-cell">Tanggal bayar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((i) => (
                  <tr key={`${i.kode}-${i.jenis}-${i.ex}`} className="align-top transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                    <th scope="row" className="px-3 py-3 text-left font-normal sm:px-5">
                      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
                        <div className="hidden sm:block"><StockLogo kode={i.kode} size="xs" /></div>
                        <Link href={`/saham/${i.kode}`} className="font-bold text-emerald-700 hover:underline dark:text-emerald-400">{i.kode}</Link>
                        <StarButton kode={i.kode} className="min-h-8 min-w-8 shrink-0" />
                      </div>
                      <div className="hidden text-xs text-zinc-600 dark:text-zinc-400 sm:block">{i.nama}</div>
                      {authed && lots[i.kode] > 0 && (
                        <div className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Anda punya {lots[i.kode]} lot</div>
                      )}
                      <details className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 md:hidden">
                        <summary className="w-fit cursor-pointer rounded py-1 font-semibold">
                          Detail<span className="sr-only"> {i.kode}</span>
                        </summary>
                        <div className="space-y-1 py-1">
                          <p className="sm:hidden">{i.nama}</p>
                          <p>Harga saham {rp(i.harga)}</p>
                        </div>
                      </details>
                    </th>
                    <td className="px-2 py-4 sm:px-4">
                      <div className="whitespace-nowrap text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 sm:text-sm">{tgl(i.ex)}</div>
                      <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[i.jenis].cls}`}>
                        {BADGE[i.jenis].text}
                      </span>
                      <div className="mt-1.5 text-xs tabular-nums text-zinc-600 dark:text-zinc-400 md:hidden">
                        <span className="font-semibold">Bayar</span> {i.bayar === null ? "belum tersedia" : tgl(i.bayar)}
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums md:table-cell">
                      {rp(i.harga)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400 sm:px-5">
                      {pct(i.yield_pct)}
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-600 dark:text-zinc-400 md:table-cell">
                      {i.bayar === null ? "Belum tersedia" : tgl(i.bayar)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      <p className="max-w-3xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        Jadwal terkonfirmasi bersumber dari keterbukaan informasi IDX dan TradingView. Perkiraan mengikuti pola ex-date tahun lalu. Cek pengumuman resmi IDX atau KSEI untuk cum-date dan jadwal terbaru.
      </p>
    </main>
  );
}
