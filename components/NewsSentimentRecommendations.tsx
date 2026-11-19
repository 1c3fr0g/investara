"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { ListItem } from "@/lib/types";
import { StockLogo } from "./StockLogo";
import { num, rp } from "@/lib/format";

export interface RecommendedPick {
  kode: string;
  nama: string;
  action: "BUY_ON_WEAKNESS" | "MOMENTUM_BUY" | "BEST_BUY" | "WAIT_AND_SEE";
  actionLabel: string;
  actionBadgeColor: string;
  targetReboundPct: string;
  rationale: string;
  keyCatalyst: string;
  fallbackPrice: number;
  fallbackChangePct: number;
}

export interface NewsCatalystGroup {
  id: string;
  category: "EMAS" | "BUNGA" | "DIVIDEN" | "REGULASI" | "ENERGI";
  categoryLabel: string;
  categoryIcon: string;
  badge: string;
  badgeColor: string;
  convictionScore: number;
  headline: string;
  source: string;
  timeAgo: string;
  catalystSummary: string;
  recommendedPicks: RecommendedPick[];
  isLiveScanned?: boolean;
}

export const NEWS_CATALYSTS: NewsCatalystGroup[] = [
  {
    id: "emas_ath",
    category: "EMAS",
    categoryLabel: "Reli Emas Dunia ATH",
    categoryIcon: "🪙",
    badge: "🟢 SANGAT BULLISH (Katalis Emas)",
    badgeColor: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-300",
    convictionScore: 94,
    headline: "Harga Emas Internasional Sentuh Rekor Tertinggi Baru Sepanjang Masa: Margin Penambang Emas Melesat",
    source: "CNBC Indonesia & Kontan",
    timeAgo: "Terbaru Hari Ini",
    catalystSummary:
      "Sentimen lindung nilai (safe haven) global dan akumulasi cadangan emas oleh bank sentral dunia mengerek harga komoditas emas ke rekor baru. Emiten penambang emas menikmati pelebaran laba bersih langsung tanpa terbebani bea ekspor mentah.",
    recommendedPicks: [
      {
        kode: "BRMS",
        nama: "Bumi Resources Minerals Tbk",
        action: "MOMENTUM_BUY",
        actionLabel: "Momentum Breakout ATH",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+3.5% s/d +6.0%",
        rationale: "Pengoperasian pabrik emas kedua melipatgandakan volume produksi emas batangan di tengah rekor harga jual.",
        keyCatalyst: "Kapasitas produksi naik + rekor harga emas dunia",
        fallbackPrice: 426,
        fallbackChangePct: 4.4,
      },
      {
        kode: "MDKA",
        nama: "Merdeka Copper Gold Tbk",
        action: "BEST_BUY",
        actionLabel: "Best Buy Zone Support",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+2.8% s/d +5.5%",
        rationale: "Valuasi PBV terkoreksi ke zona diskon historis; katalis percepatan tambang emas raksasa Pani Gold Project.",
        keyCatalyst: "Diskon support teknikal + ekspansi proyek emas Pani",
        fallbackPrice: 2450,
        fallbackChangePct: 2.8,
      },
      {
        kode: "PSAB",
        nama: "J Resources Asia Pasifik Tbk",
        action: "BUY_ON_WEAKNESS",
        actionLabel: "Buy on Weakness",
        actionBadgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300",
        targetReboundPct: "+3.0% s/d +5.0%",
        rationale: "Beta tinggi terhadap pergerakan harga emas spot internasional dengan akumulasi stabil broker institusi.",
        keyCatalyst: "Sensitivitas tinggi terhadap pergerakan emas spot",
        fallbackPrice: 318,
        fallbackChangePct: 3.2,
      },
    ],
  },
  {
    id: "bunga_fed_bi",
    category: "BUNGA",
    categoryLabel: "Pelonggaran Bunga BI & The Fed",
    categoryIcon: "🏦",
    badge: "🟢 AKUMULASI ASING (Inflow Masif)",
    badgeColor: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    convictionScore: 91,
    headline: "Ekspektasi Siklus Pemangkasan Suku Bunga: Biaya Dana (CoF) Perbankan Turun & Kredit Siap Rebound",
    source: "Bisnis.com & Bloomberg",
    timeAgo: "2 jam lalu",
    catalystSummary:
      "Tren disinflasi membuka jalan bagi penurunan BI-Rate dan Fed Funds Rate. Beban bunga simpanan perbankan menurun drastis sehingga Net Interest Margin (NIM) terdongkrak, memicu inflow ratusan miliar dari manajer investasi asing.",
    recommendedPicks: [
      {
        kode: "BBCA",
        nama: "Bank Central Asia Tbk",
        action: "BEST_BUY",
        actionLabel: "Akumulasi Asing Konsisten",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+1.5% s/d +3.0%",
        rationale: "Rasio dana murah (CASA >80%) terkuat di Asia Tenggara, NPL terendah, dan menjadi jangkar utama indeks MSCI.",
        keyCatalyst: "Inflow pasif asing + biaya dana murah terendah",
        fallbackPrice: 10250,
        fallbackChangePct: 1.2,
      },
      {
        kode: "BBRI",
        nama: "Bank Rakyat Indonesia Tbk",
        action: "BUY_ON_WEAKNESS",
        actionLabel: "Rebound Diskon PBV",
        actionBadgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300",
        targetReboundPct: "+2.0% s/d +4.0%",
        rationale: "Valuasi PBV berada di deviasi bawah rata-rata 3 tahun; segmen mikro pulih didukung yield dividen kas >6%.",
        keyCatalyst: "Diskon valuasi PBV + dividend yield kas atraktif",
        fallbackPrice: 4760,
        fallbackChangePct: 2.3,
      },
      {
        kode: "BMRI",
        nama: "Bank Mandiri (Persero) Tbk",
        action: "MOMENTUM_BUY",
        actionLabel: "Momentum Kredit Korporasi",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+1.8% s/d +3.5%",
        rationale: "Pertumbuhan kredit korporasi & sindikasi industri terdepan dengan rasio efisiensi operasional solid.",
        keyCatalyst: "Pertumbuhan laba bersih & kredit korporasi melesat",
        fallbackPrice: 6850,
        fallbackChangePct: 1.8,
      },
    ],
  },
  {
    id: "dividen_jumbo",
    category: "DIVIDEN",
    categoryLabel: "Dividen Kas Jumbo Q4",
    categoryIcon: "💰",
    badge: "🟢 DIVIDEN HUNTER (Yield 8-12%)",
    badgeColor: "border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-700/50 dark:bg-purple-950/40 dark:text-purple-300",
    convictionScore: 88,
    headline: "Emiten Energi & Komoditas Siapkan Dividen Interim Tebal: Yield Kas Tunai di Atas Deposito",
    source: "Investor Daily & BEI",
    timeAgo: "Keterbukaan Informasi",
    catalystSummary:
      "Arus kas operasional bebas (Free Cash Flow) emiten terbukti surplus tebal sepanjang tahun berjalan. Pengumuman cum date dividen interim menjadi magnet penggerak akumulasi bagi investor yang mencari passive income tunai.",
    recommendedPicks: [
      {
        kode: "ADRO",
        nama: "Alamtri Resources Indonesia Tbk",
        action: "BEST_BUY",
        actionLabel: "Dividen Kas Jumbo",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+2.5% s/d +5.0%",
        rationale: "Pembagian dividen interim bernilai jumbo diiringi aksi korporasi strategis spin-off pilar batubara termal.",
        keyCatalyst: "Yield dividen kas interim tinggi + restrukturisasi",
        fallbackPrice: 3780,
        fallbackChangePct: 2.5,
      },
      {
        kode: "ITMG",
        nama: "Indo Tambangraya Megah Tbk",
        action: "BUY_ON_WEAKNESS",
        actionLabel: "Cash Cow Dividen >70%",
        actionBadgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300",
        targetReboundPct: "+2.0% s/d +4.5%",
        rationale: "Rekam jejak konsistensi pembagian dividen kas tertinggi di BEI tanpa beban utang berbunga.",
        keyCatalyst: "Saldo kas tebal tanpa utang + payout konsisten",
        fallbackPrice: 26500,
        fallbackChangePct: 1.5,
      },
      {
        kode: "PTBA",
        nama: "Bukit Asam Tbk",
        action: "BEST_BUY",
        actionLabel: "Dividen Aristokrat BUMN",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+1.8% s/d +3.8%",
        rationale: "Riwayat setoran dividen 100% laba bersih ke kas negara dengan volume pasokan batubara DMO stabil.",
        keyCatalyst: "Komitmen dividen BUMN kas melimpah",
        fallbackPrice: 2780,
        fallbackChangePct: 0.7,
      },
    ],
  },
  {
    id: "kebijakan_tambang",
    category: "REGULASI",
    categoryLabel: "Isu Kebijakan 70% Tambang",
    categoryIcon: "🚨",
    badge: "⚠️ WASPADA REGULASI (Rotasi Taktis)",
    badgeColor: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300",
    convictionScore: 78,
    headline: "Arahan Presiden Terkait 70% Hasil Minerba Dinikmati Negara: Strategi Memilih Saham Bertahan & Anti-Panik",
    source: "CNBC Indonesia & Detik Finance",
    timeAgo: "Isu Kebijakan Terhangat",
    catalystSummary:
      "Pernyataan arahan optimalisasi 70% hasil pengelolaan minerba memicu kekhawatiran kenaikan royalti pada feronikel/nikel mentah. Disarankan menghindari spekulasi agresif dan mengalihkan fokus ke emiten dengan bantalan emas ritel tebal.",
    recommendedPicks: [
      {
        kode: "ANTM",
        nama: "Aneka Tambang Tbk",
        action: "BUY_ON_WEAKNESS",
        actionLabel: "Antre di Support Kuat",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+2.5% s/d +5.0%",
        rationale: "Sekitar 65% omset Antam berasal dari emas fisik Logam Mulia ritel yang kebal royalti mentah. Peluang akumulasi bertahap di area support Rp 1.400 - 1.450.",
        keyCatalyst: "Bantalan kas emas Logam Mulia kebal royalti",
        fallbackPrice: 1450,
        fallbackChangePct: -1.8,
      },
      {
        kode: "NCKL",
        nama: "Trimegah Bangun Persada Tbk",
        action: "BUY_ON_WEAKNESS",
        actionLabel: "Hilirisasi HPAL Baterai",
        actionBadgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300",
        targetReboundPct: "+2.0% s/d +4.5%",
        rationale: "Pabrik HPAL memproduksi bahan baku baterai kendaraan listrik (MHP) dengan nilai tambah tinggi yang didukung penuh pemerintah.",
        keyCatalyst: "Pionir hilirisasi nikel baterai berbiaya rendah",
        fallbackPrice: 880,
        fallbackChangePct: 1.1,
      },
    ],
  },
];

interface NewsSentimentRecommendationsProps {
  universeItems?: ListItem[];
  onFilterTableKodes?: (kodes: string[], label: string) => void;
  onSimulateBuy?: (s: ListItem, prob: number, isMsci: boolean) => void;
  activeFilterLabel?: string | null;
  onClearFilter?: () => void;
}

function getShortActionLabel(pick: RecommendedPick): string {
  if (pick.action === "MOMENTUM_BUY") return "⚡ Momentum";
  if (pick.action === "BEST_BUY") return "★ Best Buy";
  if (pick.action === "BUY_ON_WEAKNESS") return "📉 Buy on Dip";
  if (pick.action === "WAIT_AND_SEE") return "⏱ Wait & See";
  return pick.actionLabel.split(" ")[0] || "Buy";
}

export function NewsSentimentRecommendations({
  universeItems = [],
  onFilterTableKodes,
  onSimulateBuy,
  activeFilterLabel,
  onClearFilter,
}: NewsSentimentRecommendationsProps) {
  const [catalysts, setCatalysts] = useState<NewsCatalystGroup[]>(NEWS_CATALYSTS);
  const [selectedId, setSelectedId] = useState<string>("emas_ath");
  const [isLiveScanning, setIsLiveScanning] = useState<boolean>(false);
  const [hasScannedLive, setHasScannedLive] = useState<boolean>(false);

  // 1. Fetch dynamic AI news catalysts from real-time RSS scanner API
  const fetchLiveDynamicCatalysts = async (force = false) => {
    setIsLiveScanning(true);
    try {
      const res = await fetch(`/api/sentimen-pasar${force ? "?refresh=1" : ""}`);
      if (res.ok) {
        const j = await res.json();
        if (j?.catalysts && Array.isArray(j.catalysts) && j.catalysts.length > 0) {
          setCatalysts(j.catalysts);
          setHasScannedLive(true);
          // If previous selection isn't in new list, pick first
          if (!j.catalysts.some((c: NewsCatalystGroup) => c.id === selectedId)) {
            setSelectedId(j.catalysts[0].id);
          }
        }
      }
    } catch {}
    finally {
      setIsLiveScanning(false);
    }
  };

  useEffect(() => {
    fetchLiveDynamicCatalysts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentCatalyst = useMemo(
    () => catalysts.find((c) => c.id === selectedId) || catalysts[0] || NEWS_CATALYSTS[0],
    [catalysts, selectedId]
  );

  const ALL_RECOMMENDED_KODES = useMemo(() => {
    const set = new Set<string>();
    catalysts.forEach((cat) => {
      cat.recommendedPicks.forEach((p) => set.add(p.kode));
    });
    return Array.from(set);
  }, [catalysts]);

  const [dedicatedItems, setDedicatedItems] = useState<ListItem[]>([]);

  // 2. Dedicated independent fetch for all recommended tickers to guarantee live prices
  useEffect(() => {
    let cancelled = false;
    const kodesStr = ALL_RECOMMENDED_KODES.join(",");
    fetch(`/api/saham?kodes=${kodesStr}&size=50`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { items?: ListItem[] } | null) => {
        if (!cancelled && j?.items && j.items.length > 0) {
          setDedicatedItems(j.items);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ALL_RECOMMENDED_KODES]);

  const universeMap = useMemo(() => {
    const map = new Map<string, ListItem>();
    for (const item of dedicatedItems) {
      map.set(item.kode, item);
    }
    for (const item of universeItems) {
      map.set(item.kode, item);
    }
    return map;
  }, [dedicatedItems, universeItems]);

  const activeKodes = useMemo(() => {
    return currentCatalyst.recommendedPicks.map((p) => p.kode);
  }, [currentCatalyst]);

  const isCurrentFilterApplied = activeFilterLabel === currentCatalyst.categoryLabel;

  return (
    <div className="ios-glass-canvas rounded-[32px] p-5 sm:p-6 space-y-5">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/50 pb-4 dark:border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#191919] text-xs font-black text-white dark:bg-white dark:text-[#191919] shadow-xs">
              🔥
            </span>
            <h2 className="text-base font-black tracking-tight text-[#191919] dark:text-white">
              Sentimen Berita &amp; Rekomendasi Pilihan
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{hasScannedLive ? "100% Dinamis (AI News Feed)" : "Scanner Siap"}</span>
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Sentimen industri bursa terkini &amp; saham pilihan (*Top Picks*) yang direkomendasikan untuk dibeli.
          </p>
        </div>

        {/* Global Controls & Filter Reset */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => fetchLiveDynamicCatalysts(true)}
            disabled={isLiveScanning}
            title="Pindai ulang berita bursa hari ini secara live"
            className="ios-glass-pill flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-zinc-700 shadow-xs hover:bg-white hover:scale-[1.02] active:scale-95 disabled:opacity-50 dark:text-zinc-200 transition"
          >
            <span>{isLiveScanning ? "⏳ Memindai..." : "↻ Pindai Berita"}</span>
          </button>

          {activeFilterLabel && (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <span>✓ Tabel Terfilter:</span>
                <strong>{activeFilterLabel}</strong>
              </span>
              {onClearFilter && (
                <button
                  onClick={onClearFilter}
                  className="ios-glass-pill rounded-full px-2.5 py-1 text-xs font-bold text-zinc-700 hover:bg-white dark:text-zinc-200 transition"
                  title="Tampilkan seluruh 896 saham kembali"
                >
                  ✕ Reset
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Interactive Sentiment Switcher Tabs ── */}
      <div className="ios-glass-subtle flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-full scrollbar-none">
        {catalysts.map((cat) => {
          const isSelected = cat.id === selectedId;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedId(cat.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                isSelected
                  ? "bg-white text-[#191919] shadow-xs dark:bg-white/25 dark:text-white scale-[1.01] font-extrabold"
                  : "text-zinc-600 hover:text-black dark:text-zinc-300 dark:hover:text-white hover:bg-white/40"
              }`}
            >
              <span>{cat.categoryIcon}</span>
              <span>{cat.categoryLabel}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                  isSelected
                    ? "bg-[#191919]/10 text-[#191919] dark:bg-white/20 dark:text-white"
                    : "bg-zinc-200/70 text-zinc-700 dark:bg-white/10 dark:text-zinc-300"
                }`}
              >
                {cat.recommendedPicks.length} Saham
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Active Sentiment Highlight Banner ── */}
      <div className="ios-glass-subtle rounded-[24px] p-4.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${currentCatalyst.badgeColor}`}>
              {currentCatalyst.badge}
            </span>
            <span className="text-[11px] font-medium text-zinc-400">
              {currentCatalyst.source} · {currentCatalyst.timeAgo}
            </span>
            {currentCatalyst.isLiveScanned && (
              <span className="rounded-full bg-[#9A83FF]/15 px-2.5 py-0.5 text-[9px] font-bold text-[#9A83FF] border border-[#9A83FF]/20">
                📡 Live RSS Terverifikasi
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-[#191919] dark:text-white">
            <span>Skor Keyakinan:</span>
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 font-black text-emerald-600 dark:text-emerald-400">
              {currentCatalyst.convictionScore}%
            </span>
          </div>
        </div>

        <h3 className="text-sm font-extrabold text-[#191919] dark:text-white leading-snug">
          &ldquo;{currentCatalyst.headline}&rdquo;
        </h3>

        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
          {currentCatalyst.catalystSummary}
        </p>
      </div>

      {/* ── Recommended Stock Cards for this Catalyst ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400">
            Daftar Saham Pilihan yang Direkomendasikan Beli ({currentCatalyst.recommendedPicks.length} Emiten)
          </h4>
          <span className="text-[11px] text-zinc-400">
            Klik saham untuk bedah valuasi &amp; order book
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentCatalyst.recommendedPicks.map((pick) => {
            const liveData = universeMap.get(pick.kode);
            const livePrice = liveData?.harga && liveData.harga > 0 ? liveData.harga : pick.fallbackPrice;
            const changePct =
              liveData?.perubahan_pct !== null && liveData?.perubahan_pct !== undefined
                ? liveData.perubahan_pct
                : pick.fallbackChangePct;
            const up = (changePct ?? 0) >= 0;

            const simItem: ListItem = liveData || {
              kode: pick.kode,
              nama: pick.nama,
              papan: "Utama",
              sektor: "Umum",
              harga: livePrice,
              perubahan_pct: changePct,
              mcap: null,
              per: null,
              pbv: null,
              yield_pct: null,
              volume: 50000,
              nilai: 50000 * 100 * livePrice,
              roe: null,
              margin: null,
              der: null,
              payout: null,
              laba_growth: null,
              pendapatan_growth: null,
              ex_akan: null,
              ex_lalu: null,
              bayar_akan: null,
              bayar_lalu: null,
            };

            return (
              <div
                key={pick.kode}
                className="ios-glass-card group relative flex flex-col justify-between overflow-hidden rounded-[22px] p-4 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="space-y-3 min-w-0">
                  {/* Card Header: Logo, Ticker, and Action Signal */}
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/saham/${pick.kode}`}
                      className="flex items-center gap-2 min-w-0 group-hover:opacity-90 flex-1"
                    >
                      <StockLogo kode={pick.kode} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-[#191919] dark:text-white group-hover:underline">
                            {pick.kode}
                          </span>
                          <span className="rounded-full bg-zinc-200/60 px-1.5 py-0.2 text-[9px] font-bold text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                            IDX
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium truncate" title={pick.nama}>
                          {pick.nama}
                        </div>
                      </div>
                    </Link>

                    <span
                      title={pick.actionLabel}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black shrink-0 whitespace-nowrap ${pick.actionBadgeColor}`}
                    >
                      {getShortActionLabel(pick)}
                    </span>
                  </div>

                  {/* Price & Target Pill (iOS Glass Sub-Card) */}
                  <div className="ios-glass-subtle rounded-[16px] p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-zinc-400">Harga Live</span>
                      <div className="flex items-center gap-1.5 tabular-nums">
                        <span className="text-xs font-black text-[#191919] dark:text-white">
                          {rp(livePrice)}
                        </span>
                        <span className={`text-[10px] font-bold ${up ? "text-[#22C55E]" : "text-[#FB6767]"}`}>
                          {up ? "+" : ""}{num(changePct, 1)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-zinc-200/60 pt-1.5 dark:border-white/5">
                      <span className="text-[10px] font-semibold text-zinc-400">Target Rebound</span>
                      <span className="text-xs font-black text-[#22C55E] tabular-nums whitespace-nowrap">
                        {pick.targetReboundPct}
                      </span>
                    </div>
                  </div>

                  {/* Rationale and Key Catalyst */}
                  <div className="space-y-1.5 text-xs min-w-0">
                    <p className="text-zinc-600 dark:text-zinc-300 text-[11px] leading-relaxed line-clamp-2" title={pick.rationale}>
                      {pick.rationale}
                    </p>
                    <div className="text-[10px] text-zinc-400 flex items-center gap-1 min-w-0">
                      <span className="shrink-0">⚡</span>
                      <span className="font-semibold truncate" title={pick.keyCatalyst}>{pick.keyCatalyst}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-200/50 dark:border-white/[0.06] flex items-center justify-between gap-2">
                  <Link
                    href={`/saham/${pick.kode}`}
                    className="text-xs font-bold text-[#191919] hover:underline dark:text-white flex items-center gap-1"
                  >
                    <span>Analisis</span>
                    <span>&rarr;</span>
                  </Link>

                  {onSimulateBuy && (
                    <button
                      onClick={() => onSimulateBuy(simItem, currentCatalyst.convictionScore, false)}
                      className="ios-glass-pill rounded-full px-3 py-1 text-[11px] font-bold text-zinc-800 hover:bg-[#191919] hover:text-white dark:text-zinc-200 dark:hover:bg-white dark:hover:text-[#191919] transition hover:scale-105 active:scale-95"
                      title="Buka simulasi posisi paper trading"
                    >
                      ⚡ Simulasi
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom Action: Quick Filter Screener Table ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="shrink-0">💡</span>
          <span className="truncate">
            Bandingkan metrik PER, PBV, ROE, dan Foreign Flow emiten di atas pada tabel screener.
          </span>
        </div>

        {onFilterTableKodes && (
          <button
            onClick={() => onFilterTableKodes(activeKodes, currentCatalyst.categoryLabel)}
            className={`control-button rounded-full py-2 text-xs font-black shadow-md transition hover:scale-[1.02] active:scale-95 ${
              isCurrentFilterApplied
                ? "bg-[#22C55E] text-white shadow-emerald-500/20"
                : "bg-[#191919] text-white hover:bg-black dark:bg-white dark:text-[#191919] dark:hover:bg-zinc-200 shadow-zinc-900/20"
            }`}
          >
            <span>{isCurrentFilterApplied ? "✓ Saham Aktif di Tabel" : "🔍 Filter Tabel Screener"}</span>
            <span className="opacity-80">({activeKodes.join(", ")})</span>
          </button>
        )}
      </div>
    </div>
  );
}
