"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { ListItem, ListResponse } from "@/lib/types";
import { compact, num, pct, rp } from "@/lib/format";
import { Card } from "./ui";
import { LoginButtons } from "./AuthButtons";
import { StarButton, useWatchlist } from "./Watchlist";
import { StockLogo } from "./StockLogo";
import { WatchlistActivity } from "./WatchlistActivity";

export function WatchlistPage() {
  const { status, data } = useSession();
  if (status === "loading") {
    return (
      <main className="screen-shell py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Memuat data watchlist...
      </main>
    );
  }
  if (status !== "authenticated") {
    return (
      <main className="screen-shell space-y-6 py-10">
        <h1 className="crystal-title">Watchlist Saham</h1>
        <Card className="p-6 sm:p-7 space-y-3">
          <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">Masuk untuk Memakai Watchlist</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Simpan saham pilihan Anda dengan tombol bintang (☆) dan pantau pergerakan harga serta performanya di sini.
          </p>
          <div className="pt-2">
            <LoginButtons callbackUrl="/watchlist" />
          </div>
        </Card>
      </main>
    );
  }
  return <WatchlistView key={data?.user?.id} />;
}

function WatchlistView() {
  const { list, ready, error: watchlistError, reload } = useWatchlist();
  const [items, setItems] = useState<ListItem[]>([]);
  const [updated, setUpdated] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [quoteError, setQuoteError] = useState(false);
  const [retry, setRetry] = useState(0);
  const kodesKey = [...list].sort().join(",");

  useEffect(() => {
    if (!ready) return;
    if (!kodesKey) return;
    const controller = new AbortController();
    let pending = false;
    const load = () => {
      if (pending) return;
      pending = true;
      setBusy(true);
      const codes = kodesKey.split(",");
      const batches = [];
      for (let start = 0; start < codes.length; start += 300) {
        const query = new URLSearchParams({ kodes: codes.slice(start, start + 300).join(","), size: "300" });
        batches.push(fetch(`/api/saham?${query}`, { signal: controller.signal }).then(async (r): Promise<ListResponse> => {
          if (!r.ok) throw new Error("Harga belum tersedia.");
          return r.json();
        }));
      }
      Promise.all(batches)
        .then((results) => {
          if (controller.signal.aborted) return;
          setItems(results.flatMap(({ items }) => items).sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0)));
          setUpdated(Math.min(...results.map(({ updatedAt }) => updatedAt)));
          setQuoteError(false);
        })
        .catch(() => { if (!controller.signal.aborted) setQuoteError(true); })
        .finally(() => {
          pending = false;
          if (!controller.signal.aborted) setBusy(false);
        });
    };
    load();
    const t = setInterval(() => !document.hidden && load(), 60_000);
    return () => {
      controller.abort();
      clearInterval(t);
    };
  }, [kodesKey, ready, retry]);

  const shown = list.length ? items.filter((i) => list.includes(i.kode)) : [];

  return (
    <main className="screen-shell space-y-8 screen-section">
      <div className="crystal-intro flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="crystal-title">Watchlist Saham</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {list.length} saham dipantau{updated && <> · diperbarui {new Date(updated).toLocaleTimeString("id-ID")}</>}{busy && " · memuat..."}
          </p>
        </div>
        {shown.length >= 2 && (
          <Link
            href={`/bandingkan?k=${shown.slice(0, 4).map((s) => s.kode).join(",")}`}
            className="rounded-xl bg-green-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-green-700 transition"
          >
            Bandingkan {Math.min(4, shown.length)} Teratas
          </Link>
        )}
      </div>

      {ready && list.length > 0 && <WatchlistActivity kodesKey={kodesKey} />}

      <Card className="overflow-hidden p-0 shadow-xs">
        {watchlistError ? (
          <div className="flex flex-wrap items-center gap-3 p-5 text-sm">
            <p role="alert">Watchlist gagal dimuat.</p>
            <button type="button" onClick={() => void reload()} className="control-button ios-glass-pill rounded-xl font-semibold">Coba lagi</button>
          </div>
        ) : !ready ? (
          <p className="p-12 text-center text-sm text-zinc-500 dark:text-zinc-400">Memuat watchlist...</p>
        ) : list.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Watchlist Anda masih kosong.</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Klik tanda ☆ di <Link href="/" className="font-semibold text-green-700 underline dark:text-green-400">daftar saham</Link> atau halaman detail untuk menambahkan.
            </p>
          </div>
        ) : (
          <>
          {quoteError && (
            <div className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <p role="alert">Harga terbaru gagal dimuat.</p>
              <button type="button" onClick={() => setRetry((value) => value + 1)} className="control-button ios-glass-pill rounded-xl font-semibold">Coba lagi</button>
            </div>
          )}
          {shown.length === 0 && !quoteError && (
            <p role="status" className="p-4 text-sm">{busy || updated === null ? "Memuat harga saham…" : "Harga saham pantauan belum tersedia."}</p>
          )}
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50/80 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                  {["", "Kode", "Nama Perusahaan", "Harga", "Perubahan", "PER", "PBV", "Yield", "ROE", "Market Cap"].map((h, i) => (
                    <th key={i} className={`whitespace-nowrap px-4 py-3.5 ${i < 3 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {shown.map((s) => (
                  <tr key={s.kode} className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                    <td className="py-3.5 pl-4 pr-1 text-center"><StarButton kode={s.kode} /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <StockLogo kode={s.kode} size="sm" />
                        <Link href={`/saham/${s.kode}`} className="font-bold text-green-700 hover:underline dark:text-green-400 text-sm">
                          {s.kode}
                        </Link>
                      </div>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">{s.nama}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">{rp(s.harga)}</td>
                    <td className={`whitespace-nowrap px-4 py-3.5 text-right font-bold tabular-nums ${(s.perubahan_pct ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {s.perubahan_pct === null ? "-" : `${(s.perubahan_pct ?? 0) >= 0 ? "▲" : "▼"} ${num(Math.abs(s.perubahan_pct), 2)}%`}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{s.per === null ? "-" : `${num(s.per, 1)}x`}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{s.pbv === null ? "-" : `${num(s.pbv, 2)}x`}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{pct(s.yield_pct)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{pct(s.roe, 1)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums font-medium text-zinc-600 dark:text-zinc-400">{compact(s.mcap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>
    </main>
  );
}
