"use client";

import { useState } from "react";
import type { CorporateAction, NewsItem, StockSplit } from "@/lib/types";
import { Card } from "./ui";

export function StockNewsCorporate({
  kode,
  berita = [],
  splits = [],
  corporateActions = [],
}: {
  kode: string;
  berita?: NewsItem[];
  splits?: StockSplit[];
  corporateActions?: CorporateAction[];
}) {
  const [tab, setTab] = useState<"berita" | "corporate">("berita");
  const [sentimentFilter, setSentimentFilter] = useState<"ALL" | "REGULASI" | "BULLISH" | "BEARISH">("ALL");

  const policyCount = berita.filter((b) => b.sentiment === "REGULASI_NEGATIF").length;
  const bullishCount = berita.filter((b) => b.sentiment === "BULLISH").length;
  const bearishCount = berita.filter((b) => b.sentiment === "BEARISH").length;

  const filteredBerita = berita.filter((b) => {
    if (sentimentFilter === "REGULASI") return b.sentiment === "REGULASI_NEGATIF";
    if (sentimentFilter === "BULLISH") return b.sentiment === "BULLISH";
    if (sentimentFilter === "BEARISH") return b.sentiment === "BEARISH";
    return true;
  });

  return (
    <Card className="space-y-4">
      {/* Header and Tab Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#191919] text-xs font-black text-white dark:bg-white dark:text-[#191919]">
              📰
            </span>
            <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">
              Berita, Kebijakan &amp; Aksi Korporasi {kode}
            </h2>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Pantauan sentimen pasar langsung (CNBC, Kontan, Bisnis.com), risiko regulasi/kebijakan pemerintah, dan aksi korporasi BEI.
          </p>
        </div>

        <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-1 text-xs dark:border-zinc-800 dark:bg-zinc-800">
          <button
            onClick={() => setTab("berita")}
            className={`rounded-lg px-3 py-1.5 font-semibold transition ${
              tab === "berita"
                ? "bg-white text-green-700 shadow-sm dark:bg-zinc-900 dark:text-green-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Berita &amp; Kebijakan ({berita.length})
          </button>
          <button
            onClick={() => setTab("corporate")}
            className={`rounded-lg px-3 py-1.5 font-semibold transition ${
              tab === "corporate"
                ? "bg-white text-green-700 shadow-sm dark:bg-zinc-900 dark:text-green-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Aksi Korporasi ({splits.length + corporateActions.length})
          </button>
        </div>
      </div>

      {tab === "berita" ? (
        <div className="space-y-3.5">
          {/* Sentiment Sub-filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSentimentFilter("ALL")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                sentimentFilter === "ALL"
                  ? "bg-[#191919] text-white dark:bg-white dark:text-[#191919]"
                  : "border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Semua ({berita.length})
            </button>
            {policyCount > 0 && (
              <button
                onClick={() => setSentimentFilter("REGULASI")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1.5 ${
                  sentimentFilter === "REGULASI"
                    ? "bg-rose-600 text-white"
                    : "border border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                }`}
              >
                <span>🚨 Regulasi &amp; Kebijakan ({policyCount})</span>
              </button>
            )}
            {bullishCount > 0 && (
              <button
                onClick={() => setSentimentFilter("BULLISH")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1.5 ${
                  sentimentFilter === "BULLISH"
                    ? "bg-emerald-600 text-white"
                    : "border border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                }`}
              >
                <span>🟢 Katalis Positif ({bullishCount})</span>
              </button>
            )}
            {bearishCount > 0 && (
              <button
                onClick={() => setSentimentFilter("BEARISH")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1.5 ${
                  sentimentFilter === "BEARISH"
                    ? "bg-amber-600 text-white"
                    : "border border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                }`}
              >
                <span>🔴 Tekanan Sentimen ({bearishCount})</span>
              </button>
            )}
          </div>

          {filteredBerita.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Tidak ada berita yang sesuai dengan filter sentimen ini.
            </div>
          ) : (
            filteredBerita.map((item) => {
              const isPolicy = item.sentiment === "REGULASI_NEGATIF";
              const isBullish = item.sentiment === "BULLISH";
              const isBearish = item.sentiment === "BEARISH";

              const badgeColor = isPolicy
                ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700/60 dark:bg-rose-950/60 dark:text-rose-300"
                : isBullish
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                : isBearish
                ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-300"
                : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300";

              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group block rounded-2xl border p-4 transition ${
                    isPolicy
                      ? "border-rose-200/80 bg-rose-50/15 hover:border-rose-400 hover:bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/10 dark:hover:border-rose-700"
                      : "border-zinc-100 bg-white/60 hover:border-green-300 hover:bg-green-50/30 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-green-800/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-green-700 dark:text-green-400">
                        {item.penerbit}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{item.tanggal}</span>
                    </div>

                    {item.sentimentLabel && (
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${badgeColor}`}>
                        {item.sentimentLabel}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-zinc-900 transition group-hover:text-green-700 dark:text-zinc-100 dark:group-hover:text-green-400">
                    {item.judul}
                  </h3>

                  {item.ringkasan && (
                    <p className="mt-1 text-xs text-zinc-600 line-clamp-2 dark:text-zinc-400">
                      {item.ringkasan}
                    </p>
                  )}

                  {item.ringkasanDampak && (
                    <div className="mt-2.5 rounded-xl border border-zinc-200/60 bg-zinc-50/80 p-2.5 text-[11px] text-zinc-600 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-zinc-300 flex items-start gap-2">
                      <span className="text-xs shrink-0">⚡</span>
                      <div>
                        <strong className="text-[#191919] dark:text-white">Analisis Dampak Katalis:</strong>{" "}
                        {item.ringkasanDampak}
                      </div>
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="inline-flex items-center text-xs font-semibold text-green-600 dark:text-green-400">
                      Baca Sumber Resmi →
                    </span>
                  </div>
                </a>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stock Splits */}
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Riwayat Stock Split / Reverse Split
            </h3>
            {splits.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Tidak ada catatan stock split dalam 10 tahun terakhir.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {splits.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Rasio {s.rasio}
                      </span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Faktor pengali: {s.faktor}x
                      </p>
                    </div>
                    <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {s.tanggal}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Issue & Other Corporate Actions */}
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Rights Issue, HMETD & Pengumuman Penting
            </h3>
            {corporateActions.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Belum ada jadwal rights issue atau aksi korporasi aktif lainnya saat ini.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {corporateActions.map((ca, i) => (
                  <div key={i} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-950/70 dark:text-green-300">
                        {ca.jenis}
                      </span>
                      <span className="text-xs text-zinc-400">{ca.tanggal}</span>
                    </div>
                    <h4 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {ca.judul}
                    </h4>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{ca.keterangan}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

