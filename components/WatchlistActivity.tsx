"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { WatchlistActivityResponse } from "@/lib/watchlistActivity";
import { Card } from "./ui";

const date = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
});

const kindLabels = { filter: "Screener", price: "Alert harga", news: "Berita" };

export function WatchlistActivity({ kodesKey }: { kodesKey: string }) {
  const [refresh, setRefresh] = useState(0);
  const [request, setRequest] = useState<{ key: string; data: WatchlistActivityResponse | null }>();
  const requestKey = `${kodesKey}:${refresh}`;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/watchlist/activity", { signal: controller.signal });
        if (!response.ok) throw new Error("Gagal memuat perubahan terbaru.");
        const data: WatchlistActivityResponse = await response.json();
        if (!controller.signal.aborted) setRequest({ key: requestKey, data });
      } catch {
        if (!controller.signal.aborted) setRequest({ key: requestKey, data: null });
      }
    }
    void load();
    return () => controller.abort();
  }, [requestKey]);

  const loading = request?.key !== requestKey;
  const data = loading ? null : request?.data;
  const watchlist = new Set(kodesKey.split(","));
  const items = data?.items.map((item) => ({
    ...item, kodes: item.kodes.filter((kode) => watchlist.has(kode)),
  })).filter((item) => item.kodes.length > 0) ?? [];

  return (
    <Card className="space-y-3">
      <section aria-labelledby="watchlist-activity-title" className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <h2 id="watchlist-activity-title" className="text-lg font-bold">Perubahan Terbaru</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Alert dan berita saham pantauan dalam 3 hari terakhir.</p>
          </div>
          <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading}
            className="ios-glass-pill control-button min-h-11 cursor-pointer rounded-xl text-xs font-semibold disabled:cursor-default disabled:opacity-50">
            Perbarui
          </button>
        </div>
        {loading && <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">Memuat perubahan terbaru…</p>}
        {!loading && !data && <p role="status" className="text-sm text-rose-700 dark:text-rose-300">Gagal memuat perubahan terbaru. Tekan Perbarui untuk mencoba lagi.</p>}
        {data && (
          <div className="space-y-2">
            {data.alertUnavailable && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">Alert sedang tidak tersedia.</p>}
            {data.newsStatus !== "ready" && (
              <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
                {data.newsStatus === "partial" ? "Sebagian sumber berita sedang tidak tersedia." : "Sumber berita sedang tidak tersedia."}
              </p>
            )}
            {data.newsLimited && <p className="text-sm text-zinc-600 dark:text-zinc-400">Berita mencakup 30 saham pertama yang ditambahkan.</p>}
            {!items.length && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {data.alertUnavailable || data.newsStatus !== "ready" ? "Belum ada perubahan dari sumber yang tersedia." : "Belum ada alert atau berita terbaru."}
              </p>
            )}
            {items.length > 0 && (
              <ul className="divide-y divide-zinc-200/80 dark:divide-white/10">
                {items.map((item) => (
                  <li key={item.id} className="min-w-0 py-2 wrap-anywhere">
                    <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="font-bold text-green-800 dark:text-green-300">{item.kodes.join(", ")}</span>
                      <span>{kindLabels[item.kind]}</span>
                    </p>
                    <Link href={item.href} prefetch={false}
                      target={item.kind === "news" ? "_blank" : undefined}
                      rel={item.kind === "news" ? "noopener noreferrer" : undefined}
                      className="flex min-h-11 w-fit max-w-full items-center rounded-md py-1 text-sm font-semibold text-zinc-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-zinc-100">
                      {item.title}
                    </Link>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {item.detail} · <time dateTime={new Date(item.at).toISOString()}>{date.format(item.at)} WIB</time>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </Card>
  );
}
