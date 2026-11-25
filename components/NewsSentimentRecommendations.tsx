"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { NewsDirection, NewsScan } from "@/lib/sentimentScanner";
import type { ListItem } from "@/lib/types";
import { num, rp } from "@/lib/format";
import { StockLogo } from "./StockLogo";
import { useHomeMarket } from "./HomeMarketProvider";

type SimulationQuote = Pick<ListItem, "kode" | "nama" | "harga" | "foreign_status">;
type Filter = { kodes: string[]; label: string };
type Article = NewsScan["catalysts"][number]["article"];
type NewsPick = NewsScan["picks"][number];
const INITIAL_CARDS = 6;

const jakartaDate = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
});
const sentimentLabel: Record<Article["sentiment"], string> = {
  BULLISH: "Judul bernada positif",
  BEARISH: "Judul mengindikasikan tekanan",
  REGULASI_NEGATIF: "Perkembangan regulasi",
  NEUTRAL: "Judul informatif",
};
const directions = ["TAKE", "AVOID", "WATCH"] as const;
const directionLabels: Record<NewsDirection, string> = {
  TAKE: "Kandidat ambil",
  AVOID: "Hindari entry",
  WATCH: "Pantau",
};
const emptyDirection: Record<NewsDirection, string> = {
  TAKE: "Belum ada berita positif emiten dengan kuotasi yang bergerak searah.",
  AVOID: "Belum ada berita yang menunjukkan risiko langsung pada emiten.",
  WATCH: "Belum ada saham dalam pantauan.",
};
const directionText: Record<NewsDirection, string> = {
  TAKE: "text-emerald-800 dark:text-emerald-300",
  AVOID: "text-rose-800 dark:text-rose-300",
  WATCH: "text-zinc-700 dark:text-zinc-200",
};

function filterLabel(direction: NewsDirection, topic: string) {
  return `${directionLabels[direction]} · ${topic}`;
}

function ArticleSource({ article }: { article: Article }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
      <a href={article.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
        {article.penerbit}
      </a>
      <time dateTime={new Date(article.publishedAt).toISOString()}>{jakartaDate.format(article.publishedAt)} WIB</time>
    </div>
  );
}
export function NewsSentimentRecommendations({
  onFilterTableKodes,
  onSimulateBuy,
  activeFilter,
  onClearFilter,
}: {
  onFilterTableKodes?: (kodes: string[], label: string) => void;
  onSimulateBuy?: (item: SimulationQuote) => void;
  activeFilter?: Filter | null;
  onClearFilter?: () => void;
}) {
  const { scan, selectedId, setSelectedId, isScanning, hasError, refresh } = useHomeMarket();

  const sectors = scan?.sectors ?? [];
  const currentSector = sectors.find((group) => group.id === selectedId);
  const current = currentSector ?? scan?.catalysts.find((group) => group.id === selectedId);
  const selectedTopic = current?.label ?? "Semua tema";
  const visiblePicks = current?.picks ?? scan?.picks ?? [];
  const scopes = scan ? [{ label: "Semua tema", picks: scan.picks }, ...scan.catalysts, ...sectors] : [];
  const filteredPicks = scopes.flatMap(({ label, picks }) =>
    picks.filter((pick) => filterLabel(pick.direction, label) === activeFilter?.label),
  );
  const invalidFilter = activeFilter && (scan || hasError) && (
    filteredPicks.length !== activeFilter.kodes.length ||
    activeFilter.kodes.some((kode) => !filteredPicks.some((pick) => pick.kode === kode))
  );
  useEffect(() => {
    if (invalidFilter) onClearFilter?.();
  }, [invalidFilter, onClearFilter]);

  const status = hasError || scan?.status === "unavailable"
    ? "Sumber berita sedang tidak tersedia."
    : scan?.status === "partial"
      ? "Sebagian feed belum tersedia. Hasil memakai berita yang berhasil dipindai."
      : null;

  return (
    <section aria-labelledby="news-catalyst-heading" className="ios-glass-canvas min-w-0 rounded-[32px] p-5 sm:p-6 space-y-5">
      <div className="flex flex-col justify-between gap-3 border-b border-zinc-200/50 pb-4 dark:border-white/[0.06] sm:flex-row sm:items-center">
        <div>
          <h2 id="news-catalyst-heading" className="text-base font-black tracking-tight text-[#191919] dark:text-white">
            Sentimen Berita &amp; Rekomendasi Pilihan
          </h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Arahan entry berdasarkan judul berita emiten dalam 72 jam terakhir dan perubahan harga harian.
          </p>
          {scan && (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Terakhir dipindai <time dateTime={scan.updatedAt}>{jakartaDate.format(new Date(scan.updatedAt))} WIB</time>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={refresh} disabled={isScanning}
            className="control-button ios-glass-pill rounded-full px-4 text-xs font-bold text-zinc-700 disabled:opacity-50 dark:text-zinc-200">
            {isScanning ? "Memindai…" : "Pindai Berita"}
          </button>
          {activeFilter && onClearFilter && (
            <button type="button" onClick={onClearFilter}
              className="control-button ios-glass-pill rounded-full px-4 text-xs font-bold text-zinc-700 dark:text-zinc-200">
              Hapus filter {activeFilter.label}
            </button>
          )}
        </div>
      </div>

      <div role="status" className="text-xs text-zinc-600 empty:hidden dark:text-zinc-300">
        {status ?? (!scan?.catalysts.length && !sectors.length && !isScanning ? "Belum ada berita pasar yang relevan dalam 72 jam terakhir." : "")}
      </div>

      {scan && scan.catalysts.length + sectors.length > 0 && (
        <>
          <div className="ios-glass-subtle flex gap-1.5 overflow-x-auto rounded-full p-1.5">
            <button type="button" aria-pressed={!current} onClick={() => setSelectedId(null)}
              className={`control-button shrink-0 rounded-full px-4 text-xs font-bold ${!current ? "crystal-active" : "text-zinc-600 dark:text-zinc-300"}`}>
              Semua tema
            </button>
            {scan.catalysts.map((group) => (
              <button key={group.id} type="button" aria-pressed={group.id === current?.id}
                onClick={() => setSelectedId(group.id)}
                className={`control-button shrink-0 rounded-full px-4 text-xs font-bold ${group.id === current?.id
                  ? "crystal-active"
                  : "text-zinc-600 hover:bg-white/40 dark:text-zinc-300"}`}>
                <span aria-hidden="true">{group.icon}</span> {group.label} · {group.picks.length}
              </button>
            ))}
          </div>

          {sectors.length > 0 && (
            <div className="space-y-2">
              <p id="news-sectors" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Sektor dibahas</p>
              <div role="group" aria-labelledby="news-sectors" className="flex flex-wrap gap-2">
                {sectors.map((sector) => (
                  <button key={sector.id} type="button" aria-pressed={sector.id === currentSector?.id}
                    onClick={() => setSelectedId(sector.id)}
                    className={`control-button ios-glass-pill rounded-full px-3 text-xs font-bold ${sector.id === currentSector?.id
                      ? "crystal-active"
                      : "text-zinc-700 dark:text-zinc-200"}`}>
                    <span aria-hidden="true">{sector.icon}</span> {sector.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {current && <div className="ios-glass-subtle space-y-2 rounded-[24px] p-4">
            <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
              {currentSector ? `Berita sektor · ${currentSector.label}` : current.id === "BUNGA" ? "Perkembangan suku bunga" : sentimentLabel[current.article.sentiment]}
            </p>
            <h3 className="break-words text-sm font-extrabold text-[#191919] dark:text-white">
              {current.article.judul}
            </h3>
            <ArticleSource article={current.article} />
          </div>}

          {current && visiblePicks.length === 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                {currentSector ? "Data klasifikasi emiten untuk sektor ini belum tersedia." : "Artikel dalam tema ini belum menyebut emiten BEI yang dapat dicocokkan."}
              </p>
              {scan.picks.length > 0 && (
                <button type="button" onClick={() => setSelectedId(null)} className="control-button ios-glass-pill rounded-full px-3 text-xs font-semibold">
                  Lihat semua tema
                </button>
              )}
            </div>
          ) : directions.map((direction) => {
            const picks = visiblePicks.filter((pick) => pick.direction === direction);
            const label = filterLabel(direction, selectedTopic);
            return (
              <section key={direction} aria-labelledby={`news-direction-${direction}`} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id={`news-direction-${direction}`} className={`text-sm font-black ${directionText[direction]}`}>
                    {directionLabels[direction]} ({picks.length})
                  </h3>
                  {picks.length > 0 && onFilterTableKodes && (
                    <button type="button" onClick={() => onFilterTableKodes(picks.map((pick) => pick.kode), label)}
                      aria-pressed={activeFilter?.label === label}
                      className="control-button ios-glass-pill rounded-full px-4 text-xs font-bold text-zinc-700 dark:text-zinc-200">
                      Filter screener · {directionLabels[direction]}
                    </button>
                  )}
                </div>
                {picks.length ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {picks.slice(0, INITIAL_CARDS).map((pick) => <StockDirectionCard key={pick.kode} pick={pick} onSimulateBuy={onSimulateBuy} />)}
                    </div>
                    {picks.length > INITIAL_CARDS && (
                      <details>
                        <summary className="control-button ios-glass-pill w-fit cursor-pointer rounded-full px-4 text-xs font-bold">
                          Lihat {picks.length - INITIAL_CARDS} saham lainnya · {directionLabels[direction]}
                        </summary>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {picks.slice(INITIAL_CARDS).map((pick) => <StockDirectionCard key={pick.kode} pick={pick} onSimulateBuy={onSimulateBuy} />)}
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">{emptyDirection[direction]}</p>
                    {current && scan.picks.some((pick) => pick.direction === direction) && (
                      <button type="button" onClick={() => setSelectedId(null)} className="control-button ios-glass-pill rounded-full px-3 text-xs font-semibold">
                        Lihat semua tema
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </section>
  );
}

function StockDirectionCard({ pick, onSimulateBuy }: { pick: NewsPick; onSimulateBuy?: (item: SimulationQuote) => void }) {
  return (
    <div className="ios-glass-card flex min-w-0 flex-col justify-between gap-3 rounded-[22px] p-4 shadow-xs">
      <div className="min-w-0 space-y-3">
        <Link href={`/saham/${pick.kode}`} className="flex min-w-0 items-center gap-2">
          <StockLogo kode={pick.kode} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-black text-[#191919] dark:text-white">{pick.kode}</p>
            <p className="truncate text-[11px] text-zinc-600 dark:text-zinc-400" title={pick.nama}>{pick.nama}</p>
          </div>
        </Link>
        <div className="ios-glass-subtle flex flex-wrap items-center justify-between gap-2 rounded-[16px] p-2.5 text-xs">
          <span className="text-zinc-600 dark:text-zinc-300">{pick.harga === null ? "Harga belum tersedia" : "Harga saat pindai"}</span>
          {pick.harga !== null && (
            <span className="font-bold tabular-nums text-[#191919] dark:text-white">
              {rp(pick.harga)} {pick.perubahan_pct !== null && <span>({pick.perubahan_pct > 0 ? "+" : ""}{num(pick.perubahan_pct, 1)}%)</span>}
            </span>
          )}
        </div>
        <p className="break-words text-xs font-semibold leading-relaxed text-zinc-700 dark:text-zinc-200">{pick.reason}</p>
        {pick.direction === "TAKE" && (pick.projection ? (
          <div className="ios-glass-subtle space-y-2 rounded-[16px] p-3">
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Proyeksi skenario swing</p>
            <dl className="space-y-1 text-xs">
              {([
                ["Target 1 (+1,5%)", pick.projection.tp1],
                ["Target 2 (+3%)", pick.projection.tp2],
                ["Batas risiko (−2%)", pick.projection.downside],
              ] as const).map(([label, price]) => (
                <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <dt className="text-zinc-700 dark:text-zinc-300">{label}</dt>
                  <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{rp(price)}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Acuan harga saat pindai, dibulatkan ke fraksi harga, sebelum biaya.</p>
          </div>
        ) : (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Proyeksi belum tersedia tanpa harga acuan yang valid.</p>
        ))}
        {pick.sectorLabel && (
          <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
            {pick.sectorOnly ? "Dasar pantauan sektor" : "Sektor terkait"} · {pick.sectorLabel}
          </p>
        )}
        <p className="break-words text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">{pick.article.judul}</p>
        <ArticleSource article={pick.article} />
        {!pick.sectorOnly && <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
          {pick.articleCount} artikel · {pick.positiveSources} sumber positif · {pick.negativeSources} sumber negatif
        </p>}
      </div>
      {onSimulateBuy && pick.direction === "TAKE" && pick.harga !== null && (
        <button type="button" onClick={() => onSimulateBuy(pick)}
          className="control-button ios-glass-pill self-start rounded-full px-3 text-xs font-bold text-zinc-700 dark:text-zinc-200">
          Simulasi {pick.kode}
        </button>
      )}
    </div>
  );
}
