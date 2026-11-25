"use client";

import { useSearchParams } from "next/navigation";
import { signedPct } from "@/lib/format";
import { useHomeMarket } from "./HomeMarketProvider";

const jakartaTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
});

export function IhsgSectorMovements() {
  const { sectorReport, sectorFailed, setSentimentFilter } = useHomeMarket();
  const activeGroup = useSearchParams().get("grup");
  const sectors = sectorReport?.sektor ?? [];

  function selectSector(group: string) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("grup") === group) params.delete("grup");
    else params.set("grup", group);
    params.delete("page");
    params.delete("super");
    params.delete("msciOnly");

    setSentimentFilter(null);
    window.history.pushState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}#screener-table-header`);
    const screener = document.getElementById("screener-table-header");
    screener?.focus({ preventScroll: true });
    screener?.scrollIntoView({ block: "start" });
  }


  return (
    <section aria-labelledby="ihsg-sector-title" className="mt-4 min-w-0 border-t border-slate-300/60 pt-4 dark:border-white/10 sm:mt-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h3 id="ihsg-sector-title" className="text-sm font-bold text-foreground">Sektor Industri (IDX-IC)</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Perubahan harian tertimbang kapitalisasi pasar. Pilih sektor untuk menyaring saham.</p>
        </div>
        {sectorReport && sectors.length > 0 && (
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {sectorFailed ? "Data terakhir · " : ""}
            <time dateTime={new Date(sectorReport.updatedAt).toISOString()}>{jakartaTime.format(sectorReport.updatedAt)} WIB</time>
          </p>
        )}
      </div>
      {sectors.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {sectors.map(({ nama, perubahan_pct: change }) => {
            const group = `sek:${nama}`;
            const selected = activeGroup === group;
            const tone = change !== null && change > 0 ? "text-emerald-800 dark:text-emerald-300"
              : change !== null && change < 0 ? "text-rose-800 dark:text-rose-300" : "text-slate-600 dark:text-slate-300";
            return (
              <li key={nama} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectSector(group)}
                  className={`flex h-full min-h-11 w-full flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-xl px-3 py-2 text-left transition-colors ${
                    selected ? "crystal-active" : "ios-glass-subtle hover:bg-white/75 dark:hover:bg-white/10"
                  }`}
                >
                  <span className="min-w-0 wrap-break-word text-xs font-semibold">{nama}</span>
                  <span className={`shrink-0 text-sm font-bold tabular-nums ${tone}`}>
                    {signedPct(change, 1)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p role="status" className="text-xs text-slate-600 dark:text-slate-300">
          {sectorReport || sectorFailed ? "Pergerakan sektor belum tersedia." : "Memuat pergerakan sektor…"}
        </p>
      )}
    </section>
  );
}
