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

export function WatchlistPage() {
  const { status } = useSession();
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
  return <WatchlistView />;
}

function WatchlistView() {
  const { list, ready } = useWatchlist();
  const [items, setItems] = useState<ListItem[]>([]);
  const [updated, setUpdated] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const kodesKey = [...list].sort().join(",");

  useEffect(() => {
    if (!ready) return;
    if (!kodesKey) return;
    let cancel = false;
    const load = () => {
      setBusy(true);
      fetch(`/api/saham?kodes=${kodesKey}&size=100&sort=mcap&dir=desc`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: ListResponse | null) => {
          if (cancel || !j) return;
          setItems(j.items);
          setUpdated(j.updatedAt);
        })
        .catch(() => {})
        .finally(() => !cancel && setBusy(false));
    };
    load();
    const t = setInterval(() => !document.hidden && load(), 60_000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [kodesKey, ready]);

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

      <Card className="overflow-hidden p-0 shadow-xs">
        {!ready ? (
          <p className="p-12 text-center text-sm text-zinc-500 dark:text-zinc-400">Memuat watchlist...</p>
        ) : list.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Watchlist Anda masih kosong.</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Klik tanda ☆ di <Link href="/" className="font-semibold text-green-700 underline dark:text-green-400">daftar saham</Link> atau halaman detail untuk menambahkan.
            </p>
          </div>
        ) : (
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
        )}
      </Card>
    </main>
  );
}
