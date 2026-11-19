"use client";

import type { BandarmologiData } from "@/lib/types";
import { compact, num, rp } from "@/lib/format";

interface BandarmologiCardProps {
  kode: string;
  harga: number | null;
  bandarmologi?: BandarmologiData;
}

export function BandarmologiCard({ kode, harga, bandarmologi }: BandarmologiCardProps) {
  if (!bandarmologi) return null;

  const isAccumulation = bandarmologi.status.includes("ACCUMULATION");
  const isDistribution = bandarmologi.status.includes("DISTRIBUTION");

  const badgeColor = isAccumulation
    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/60 dark:text-emerald-300"
    : isDistribution
    ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700/60 dark:bg-rose-950/60 dark:text-rose-300"
    : "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";

  return (
    <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-6 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#191919]/90 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#191919] text-xs font-black text-white dark:bg-white dark:text-[#191919]">
              🌊
            </span>
            <h2 className="text-base font-black tracking-tight text-[#191919] dark:text-white">
              Bandarmologi &amp; Broker Flow Matrix
            </h2>
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${badgeColor}`}>
              {bandarmologi.statusLabel}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Deteksi aliran dana institusi (*Smart Money*) vs ritel serta estimasi harga modal broker utama.
          </p>
        </div>

        {/* BAP Pill */}
        <div className="rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] px-4 py-2.5 text-center dark:border-white/10 dark:bg-white/[0.04] shrink-0 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Broker Avg Price (BAP Bandar)
          </div>
          <div className="mt-0.5 text-lg font-black text-[#191919] dark:text-white tabular-nums">
            {rp(bandarmologi.brokerAvgPrice)}
          </div>
          <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
            {harga && harga > bandarmologi.brokerAvgPrice ? (
              <span className="text-[#22C55E]">
                Harga live +{num(((harga - bandarmologi.brokerAvgPrice) / bandarmologi.brokerAvgPrice) * 100, 1)}% di atas BAP
              </span>
            ) : harga ? (
              <span className="text-amber-500">
                Harga live {num(((harga - bandarmologi.brokerAvgPrice) / bandarmologi.brokerAvgPrice) * 100, 1)}% di bawah BAP (Diskon)
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Foreign vs Domestic Bar */}
      <div className="rounded-2xl border border-zinc-200/60 bg-zinc-50/70 p-4 dark:border-white/[0.06] dark:bg-white/[0.02] space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-[#9A83FF] flex items-center gap-1.5">
            <span>🌍</span> Asing ({bandarmologi.foreignPct}%)
          </span>
          <span className="text-xs font-medium text-zinc-400">
            Net Flow:{" "}
            <strong className={bandarmologi.netForeignValue >= 0 ? "text-[#22C55E]" : "text-[#FB6767]"}>
              {bandarmologi.netForeignValue >= 0 ? "+" : ""}
              {compact(bandarmologi.netForeignValue)}
            </strong>
          </span>
          <span className="text-[#191919] dark:text-white flex items-center gap-1.5">
            Domestik ({bandarmologi.domesticPct}%) <span>🇮🇩</span>
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 flex">
          <div
            className="h-full bg-[#9A83FF] transition-all duration-500"
            style={{ width: `${bandarmologi.foreignPct}%` }}
            title={`Asing: ${bandarmologi.foreignPct}%`}
          />
          <div
            className="h-full bg-[#191919] dark:bg-zinc-400 transition-all duration-500"
            style={{ width: `${bandarmologi.domesticPct}%` }}
            title={`Domestik: ${bandarmologi.domesticPct}%`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>Partisipasi Ritel: <strong>{bandarmologi.retailParticipation === "LOW" ? "Rendah (Institusi Dominan)" : bandarmologi.retailParticipation === "HIGH" ? "Tinggi (Ramai Ritel)" : "Sedang"}</strong></span>
          <span>Institusi Penggerak: <strong>{isAccumulation ? "Net Buyer" : "Net Seller"}</strong></span>
        </div>
      </div>

      {/* Side-by-Side Top 3 Buyers vs Top 3 Sellers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top 3 Buyers */}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/10 space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-200/50 pb-2 dark:border-emerald-900/30">
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <span>🟢</span> Top 3 Buyer (Pembeli Terbesar)
            </span>
            <span className="text-[10px] font-semibold text-zinc-400">Avg Beli</span>
          </div>

          <div className="space-y-2">
            {bandarmologi.topBuyers.map((b, i) => (
              <div
                key={b.code}
                className="flex items-center justify-between rounded-xl bg-white/90 p-2.5 shadow-2xs dark:bg-[#191919] border border-zinc-100 dark:border-white/[0.05]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#191919] text-[11px] font-black text-white dark:bg-white dark:text-[#191919]">
                    {b.code}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#191919] dark:text-white">{b.name}</span>
                      <span className={`rounded-sm px-1 py-0.2 text-[8px] font-black ${
                        b.type === "FOREIGN"
                          ? "bg-[#9A83FF]/20 text-[#9A83FF]"
                          : "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
                      }`}>
                        {b.type === "FOREIGN" ? "ASING" : "LOKAL"}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {b.lot.toLocaleString("id-ID")} lot · {compact(b.valueRp)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-[#22C55E] tabular-nums">
                    {rp(b.avgPrice)}
                  </div>
                  <div className="text-[9px] text-zinc-400">BAP #{i + 1}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 3 Sellers */}
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/20 p-4 dark:border-rose-900/30 dark:bg-rose-950/10 space-y-3">
          <div className="flex items-center justify-between border-b border-rose-200/50 pb-2 dark:border-rose-900/30">
            <span className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
              <span>🔴</span> Top 3 Seller (Penjual Terbesar)
            </span>
            <span className="text-[10px] font-semibold text-zinc-400">Avg Jual</span>
          </div>

          <div className="space-y-2">
            {bandarmologi.topSellers.map((s, i) => (
              <div
                key={s.code}
                className="flex items-center justify-between rounded-xl bg-white/90 p-2.5 shadow-2xs dark:bg-[#191919] border border-zinc-100 dark:border-white/[0.05]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-200 text-[11px] font-black text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                    {s.code}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#191919] dark:text-white">{s.name}</span>
                      <span className={`rounded-sm px-1 py-0.2 text-[8px] font-black ${
                        s.type === "FOREIGN"
                          ? "bg-[#9A83FF]/20 text-[#9A83FF]"
                          : "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
                      }`}>
                        {s.type === "FOREIGN" ? "ASING" : "LOKAL"}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {s.lot.toLocaleString("id-ID")} lot · {compact(s.valueRp)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-[#FB6767] tabular-nums">
                    {rp(s.avgPrice)}
                  </div>
                  <div className="text-[9px] text-zinc-400">ASP #{i + 1}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Foreign Flow History & Entry Dates Breakdown */}
      {bandarmologi.timeline && bandarmologi.timeline.length > 0 && (
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-white/10 dark:bg-white/[0.02] space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/60 pb-3 dark:border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#9A83FF]/20 text-[11px] text-[#9A83FF]">
                  📅
                </span>
                <h3 className="text-xs font-black tracking-tight text-[#191919] dark:text-white">
                  Histori &amp; Tanggal Arus Dana Asing (Foreign Flow Daily Breakdown)
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Rincian transaksi harian investor asing, tanggal pasti arus modal masuk (*net buy*), serta pergerakan harga.
              </p>
            </div>

            {bandarmologi.summaryFlow5D && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="rounded-xl border border-[#9A83FF]/30 bg-[#9A83FF]/10 px-2.5 py-1 text-[10px] font-bold text-[#9A83FF]">
                  {bandarmologi.summaryFlow5D.trendLabel}
                </span>
              </div>
            )}
          </div>

          {/* Quick Summary Pill Highlight */}
          {bandarmologi.summaryFlow5D && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-zinc-200/70 bg-white/90 p-3 dark:border-white/[0.08] dark:bg-[#191919] shadow-2xs">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Tanggal Terakhir Asing Masuk
                </div>
                <div className="mt-1 text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span>🟢</span>
                  <span>{bandarmologi.summaryFlow5D.lastEntryDate}</span>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200/70 bg-white/90 p-3 dark:border-white/[0.08] dark:bg-[#191919] shadow-2xs">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Total Arus Asing (5 Hari)
                </div>
                <div className={`mt-1 text-xs font-black tabular-nums ${
                  bandarmologi.summaryFlow5D.totalNetBuyRp >= 0
                    ? "text-[#22C55E]"
                    : "text-[#FB6767]"
                }`}>
                  {bandarmologi.summaryFlow5D.totalNetBuyRp >= 0 ? "+" : ""}
                  {compact(bandarmologi.summaryFlow5D.totalNetBuyRp)}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200/70 bg-white/90 p-3 dark:border-white/[0.08] dark:bg-[#191919] shadow-2xs">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Rasio Akumulasi vs Distribusi
                </div>
                <div className="mt-1 text-xs font-semibold text-[#191919] dark:text-white flex items-center gap-2">
                  <span className="text-[#22C55E] font-bold">{bandarmologi.summaryFlow5D.daysAccumulation} Hari Buy</span>
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                  <span className="text-[#FB6767] font-bold">{bandarmologi.summaryFlow5D.daysDistribution} Hari Sell</span>
                </div>
              </div>
            </div>
          )}

          {/* Daily Timeline Rows */}
          <div className="table-scroll">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200/60 dark:border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  <th className="py-2 px-2.5">Tanggal Bursa</th>
                  <th className="py-2 px-2.5">Status Asing</th>
                  <th className="py-2 px-2.5 text-right">Net Flow (Rp)</th>
                  <th className="py-2 px-2.5 text-right">Volume Lot</th>
                  <th className="py-2 px-2.5 text-right">Harga Tutup</th>
                  <th className="py-2 px-2.5">Broker Utama</th>
                  <th className="py-2 px-2.5 hidden md:table-cell">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                {bandarmologi.timeline.map((item, idx) => {
                  const isNetBuy = item.status === "NET_BUY";
                  const isNetSell = item.status === "NET_SELL";

                  return (
                    <tr
                      key={item.date}
                      className={`transition-colors hover:bg-zinc-100/60 dark:hover:bg-white/[0.03] ${
                        idx === 0 ? "bg-emerald-50/20 dark:bg-emerald-950/10" : ""
                      }`}
                    >
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#191919] dark:text-white">{item.date}</span>
                          <span className="text-[10px] font-medium text-zinc-400">({item.dayName})</span>
                          {idx === 0 && (
                            <span className="rounded bg-[#191919] px-1 py-0.2 text-[8px] font-bold text-white dark:bg-white dark:text-[#191919]">
                              TERAKHIR
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                            isNetBuy
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : isNetSell
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          <span>{isNetBuy ? "🟢 Inflow" : isNetSell ? "🔴 Outflow" : "🟡 Netral"}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 text-right font-black tabular-nums whitespace-nowrap">
                        <span className={isNetBuy ? "text-[#22C55E]" : isNetSell ? "text-[#FB6767]" : "text-zinc-500"}>
                          {item.flowRp >= 0 ? "+" : ""}
                          {compact(item.flowRp)}
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 text-right font-medium text-zinc-600 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                        {item.flowLots.toLocaleString("id-ID")}
                      </td>

                      <td className="py-2.5 px-2.5 text-right tabular-nums whitespace-nowrap">
                        <span className="font-bold text-[#191919] dark:text-white">{rp(item.priceClose)}</span>
                        <span
                          className={`ml-1.5 text-[10px] font-bold ${
                            item.priceChangePct > 0
                              ? "text-[#22C55E]"
                              : item.priceChangePct < 0
                              ? "text-[#FB6767]"
                              : "text-zinc-400"
                          }`}
                        >
                          {item.priceChangePct > 0 ? "+" : ""}
                          {item.priceChangePct.toFixed(1)}%
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">
                          {item.mainBroker}
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 text-[11px] text-zinc-500 dark:text-zinc-400 hidden md:table-cell">
                        {item.keterangan}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

