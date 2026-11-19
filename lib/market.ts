import YahooFinance from "yahoo-finance2";
import emiten from "./emiten.json";
import { analyze } from "./analysis";
import { getTv } from "./tv";
import type { Detail, ListItem } from "./types";
import { computeBandarmologi } from "./bandarmologi";
import { computeBestBuy } from "./bestBuy";
import { computeDividendHunter } from "./dividendHunter";
import { fetchStockNews, classifyNewsSentiment, newsArticleUrl } from "./news";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const OPTS = { validateResult: false } as const;

const UNIVERSE_TTL = 60 * 1000;
const DETAIL_TTL = 30 * 60 * 1000;
const DAY = 24 * 3600 * 1000;

export const EMITEN = emiten as { kode: string; nama: string; papan: string }[];
const EMITEN_BY_CODE = new Map(EMITEN.map((e) => [e.kode, e]));
export const isKnownCode = (k: string) => EMITEN_BY_CODE.has(k);

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const times = (v: number | null, k: number) => (v === null ? null : v * k);

let universe: { at: number; items: ListItem[] } | null = null;
let universePending: Promise<ListItem[]> | null = null;

async function loadUniverse(force: boolean): Promise<ListItem[]> {
  const tv = await getTv(force);
  const symbols = EMITEN.map((e) => `${e.kode}.JK`);
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 100) chunks.push(symbols.slice(i, i + 100));

  const items: ListItem[] = [];
  for (let i = 0; i < chunks.length; i += 3) {
    const results = await Promise.all(
      chunks.slice(i, i + 3).map((c) => yf.quote(c, {}, OPTS).catch(() => [])),
    );
    for (const q of results.flat()) {
      const kode = q.symbol.replace(/\.JK$/, "");
      const meta = EMITEN_BY_CODE.get(kode);
      const harga = num(q.regularMarketPrice);
      if (!meta || harga === null) continue;
      const dps = num(q.dividendRate) ?? num(q.trailingAnnualDividendRate);
      const volume = num(q.regularMarketVolume);
      const info = tv.get(kode);
      const nilai = info?.nilai ?? (volume !== null ? volume * harga : null);
      const cmf = info?.cmf ?? null;
      const mfi = info?.mfi ?? null;

      let foreign_flow: number | null = null;
      let foreign_status: "Akumulasi Masif" | "Akumulasi" | "Netral" | "Distribusi" | "Distribusi Masif" | null = null;
      if (cmf !== null && nilai !== null) {
        foreign_flow = Math.round(nilai * cmf);
        if (cmf >= 0.15) foreign_status = "Akumulasi Masif";
        else if (cmf >= 0.04) foreign_status = "Akumulasi";
        else if (cmf <= -0.15) foreign_status = "Distribusi Masif";
        else if (cmf <= -0.04) foreign_status = "Distribusi";
        else foreign_status = "Netral";
      } else if (nilai !== null && q.regularMarketChangePercent !== undefined && q.regularMarketChangePercent !== null) {
        const estCmf = Math.max(-0.25, Math.min(0.25, (Number(q.regularMarketChangePercent) / 100) * 1.5));
        foreign_flow = Math.round(nilai * estCmf);
        if (estCmf >= 0.08) foreign_status = "Akumulasi Masif";
        else if (estCmf >= 0.03) foreign_status = "Akumulasi";
        else if (estCmf <= -0.08) foreign_status = "Distribusi Masif";
        else if (estCmf <= -0.03) foreign_status = "Distribusi";
        else foreign_status = "Netral";
      }

      items.push({
        kode,
        nama: q.longName ?? q.shortName ?? meta.nama,
        papan: meta.papan,
        sektor: info?.sektor ?? null,
        harga,
        perubahan_pct: num(q.regularMarketChangePercent),
        mcap: num(q.marketCap),
        per: num(q.trailingPE),
        pbv: num(q.priceToBook),
        yield_pct: dps !== null && dps > 0 ? (dps / harga) * 100 : null,
        volume,
        nilai,
        roe: info?.roe ?? null,
        margin: info?.margin ?? null,
        der: info?.der ?? null,
        // payout = DPS / EPS = yield% x PER
        payout:
          dps !== null && dps > 0 && num(q.trailingPE) !== null && q.trailingPE! > 0
            ? (dps / harga) * q.trailingPE!
            : null,
        laba_growth: info?.laba_growth ?? null,
        pendapatan_growth: info?.pendapatan_growth ?? null,
        ex_akan: info?.ex_akan ?? null,
        ex_lalu: info?.ex_lalu ?? null,
        bayar_akan: info?.bayar_akan ?? null,
        bayar_lalu: info?.bayar_lalu ?? null,
        cmf,
        mfi,
        foreign_flow,
        foreign_status,
      });
    }
  }
  return items.sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0));
}

export async function getUniverse(force = false): Promise<{ items: ListItem[]; updatedAt: number }> {
  if (!force && universe && Date.now() - universe.at < UNIVERSE_TTL) return { items: universe.items, updatedAt: universe.at };
  universePending ??= loadUniverse(force)
    .then((items) => {
      if (items.length) universe = { at: Date.now(), items };
      return items;
    })
    .finally(() => {
      universePending = null;
    });
  const items = await universePending;
  return { items, updatedAt: universe?.at ?? Date.now() };
}

const QUOTE_TTL = 6 * 1000; // 6 seconds for live quote updates

const detailCache = new Map<string, { at: number; quoteAt: number; data: Detail }>();

export async function getStockQuotes(codes: string[]) {
  type StockQuote = Pick<Detail, "kode" | "nama" | "perubahan_pct" | "yield_pct"> & { harga: number };
  const results = new Map<string, StockQuote>();
  const symbols: string[] = [];
  for (const kode of new Set(codes)) {
    if (!isKnownCode(kode)) continue;
    const cached = detailCache.get(kode);
    if (cached && Date.now() - cached.quoteAt < QUOTE_TTL && cached.data.harga !== null) {
      const { nama, harga, perubahan_pct, yield_pct } = cached.data;
      results.set(kode, { kode, nama, harga, perubahan_pct, yield_pct });
    } else {
      symbols.push(`${kode}.JK`);
    }
  }

  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 100) chunks.push(symbols.slice(i, i + 100));
  const quotes = await Promise.all(chunks.map((chunk) => yf.quote(chunk, {}, OPTS).catch(() => [])));
  for (const quote of quotes.flat()) {
    const kode = quote.symbol.replace(/\.JK$/, "");
    const harga = num(quote.regularMarketPrice);
    if (harga === null || harga <= 0) continue;
    const dps = num(quote.dividendRate) ?? num(quote.trailingAnnualDividendRate);
    results.set(kode, {
      kode,
      nama: quote.longName ?? quote.shortName ?? EMITEN_BY_CODE.get(kode)?.nama ?? kode,
      harga,
      perubahan_pct: num(quote.regularMarketChangePercent),
      yield_pct: dps !== null && dps > 0 ? dps / harga * 100 : null,
    });
  }
  return results;
}

export async function getDetail(kode: string, force = false): Promise<Detail> {
  const hit = detailCache.get(kode);
  const now = Date.now();
  const symbol = `${kode}.JK`;

  // If hit exists, check if quote is fresh or if ultra-fast quote refresh is needed
  if (hit) {
    const isFundamentalFresh = now - hit.at < DETAIL_TTL;
    const isQuoteFresh = !force && now - hit.quoteAt < QUOTE_TTL;

    if (isFundamentalFresh && isQuoteFresh) {
      return hit.data;
    }

    // Fast quote refresh path (< 150ms)
    if (isFundamentalFresh || force) {
      try {
        const q = await yf.quote(symbol, {}, OPTS);
        if (q && typeof q.regularMarketPrice === "number") {
          hit.data.harga = q.regularMarketPrice;
          if (typeof q.regularMarketChange === "number") hit.data.perubahan = q.regularMarketChange;
          if (typeof q.regularMarketChangePercent === "number") hit.data.perubahan_pct = q.regularMarketChangePercent;
          if (typeof q.regularMarketVolume === "number") hit.data.volume = q.regularMarketVolume;
          if (typeof q.regularMarketDayHigh === "number") hit.data.hari_tinggi = q.regularMarketDayHigh;
          if (typeof q.regularMarketDayLow === "number") hit.data.hari_rendah = q.regularMarketDayLow;
          if (hit.data.kepemilikan) {
            if (typeof q.bid === "number") hit.data.kepemilikan.bid = q.bid;
            if (typeof q.ask === "number") hit.data.kepemilikan.ask = q.ask;
            if (typeof q.bidSize === "number") hit.data.kepemilikan.bid_size = q.bidSize;
            if (typeof q.askSize === "number") hit.data.kepemilikan.ask_size = q.askSize;
          }
          if (hit.data.bandarmologi) {
            hit.data.best_buy = computeBestBuy({
              kode,
              harga: hit.data.harga,
              hari_rendah: hit.data.hari_rendah,
              hari_tinggi: hit.data.hari_tinggi,
              bap: hit.data.bandarmologi.brokerAvgPrice,
              perubahan_pct: hit.data.perubahan_pct,
              topBuyerCode: hit.data.bandarmologi.topBuyers[0]?.code,
            });
          }
          hit.quoteAt = now;
          return hit.data;
        }
      } catch {
        return hit.data;
      }
    }
  }
  const [quote, s, tv, chart, searchRes] = await Promise.all([
    yf.quote(symbol, {}, OPTS),
    yf
      .quoteSummary(symbol, {
        modules: [
          "summaryDetail",
          "defaultKeyStatistics",
          "financialData",
          "assetProfile",
          "calendarEvents",
          "majorHoldersBreakdown",
          "fundOwnership",
        ],
      })
      .catch(() => null),
    getTv(),
    yf
      .chart(symbol, { period1: new Date(now - 10 * 365 * DAY), period2: new Date(now), interval: "1mo", events: "div|split" })
      .catch(() => null),
    yf.search(symbol, {}, OPTS).catch(() => null),
  ]);

  const meta = EMITEN_BY_CODE.get(kode);
  const sd = s?.summaryDetail;
  const ks = s?.defaultKeyStatistics;
  const fd = s?.financialData;
  const ap = s?.assetProfile;
  const harga = num(quote.regularMarketPrice);

  const divs = (chart?.events?.dividends ?? []).map((d) => ({
    t: new Date(d.date).getTime(),
    y: new Date(d.date).getUTCFullYear(),
    v: d.amount,
  }));
  const annual = new Map<number, number>();
  for (const d of divs) annual.set(d.y, (annual.get(d.y) ?? 0) + d.v);
  const lastFull = new Date(now).getUTCFullYear() - 1;
  let streak = 0;
  for (let y = lastFull; (annual.get(y) ?? 0) > 0; y--) streak++;
  const startDps = annual.get(lastFull - 5) ?? 0;
  const endDps = annual.get(lastFull) ?? 0;
  const dps12 = divs.length ? divs.filter((d) => d.t >= now - 365 * DAY).reduce((a, d) => a + d.v, 0) : null;

  const exRaw = sd?.exDividendDate ?? s?.calendarEvents?.exDividendDate;
  const ex = exRaw ? new Date(exRaw as unknown as string | number | Date) : null;

  const base: Omit<Detail, "analisis"> = {
    kode,
    nama: quote.longName ?? quote.shortName ?? meta?.nama ?? kode,
    kepemilikan: {
      insider_pct: times(num(s?.majorHoldersBreakdown?.insidersPercentHeld), 100),
      institusi_pct: times(num(s?.majorHoldersBreakdown?.institutionsPercentHeld), 100),
      institusi_float_pct: times(num(s?.majorHoldersBreakdown?.institutionsFloatPercentHeld), 100),
      jumlah_institusi: num(s?.majorHoldersBreakdown?.institutionsCount),
      dana: (s?.fundOwnership?.ownershipList ?? []).slice(0, 8).map((h) => ({
        nama: String(h.organization ?? "-"),
        pct: times(num(h.pctHeld), 100),
        posisi: num(h.position),
        tanggal: h.reportDate ? new Date(h.reportDate as unknown as string).toISOString().slice(0, 10) : null,
      })),
      bid: num(quote.bid),
      ask: num(quote.ask),
      bid_size: num(quote.bidSize),
      ask_size: num(quote.askSize),
    },
    sektor: tv.get(kode)?.sektor ?? ap?.sector ?? null,
    industri: tv.get(kode)?.industri ?? ap?.industry ?? null,
    ringkasan: ap?.longBusinessSummary ?? null,
    website: ap?.website ?? null,
    karyawan: num(ap?.fullTimeEmployees),

    harga,
    perubahan: num(quote.regularMarketChange),
    perubahan_pct: num(quote.regularMarketChangePercent),
    buka: num(quote.regularMarketOpen),
    tutup_kemarin: num(quote.regularMarketPreviousClose),
    hari_rendah: num(quote.regularMarketDayLow),
    hari_tinggi: num(quote.regularMarketDayHigh),
    w52_rendah: num(quote.fiftyTwoWeekLow),
    w52_tinggi: num(quote.fiftyTwoWeekHigh),
    volume: num(quote.regularMarketVolume),
    volume_rata: num(quote.averageDailyVolume3Month),
    ma50: num(quote.fiftyDayAverage),
    ma200: num(quote.twoHundredDayAverage),
    beta: num(sd?.beta) ?? num(ks?.beta),

    mcap: num(quote.marketCap),
    per: num(quote.trailingPE),
    per_forward: num(quote.forwardPE),
    pbv: num(quote.priceToBook),
    eps: num(quote.epsTrailingTwelveMonths) ?? num(ks?.trailingEps),
    bvps: num(quote.bookValue) ?? num(ks?.bookValue),
    peg: num(ks?.pegRatio),
    ev: num(ks?.enterpriseValue),
    ps: num(sd?.priceToSalesTrailing12Months),
    ev_revenue: num(ks?.enterpriseToRevenue),

    roe_pct: times(num(fd?.returnOnEquity), 100),
    roa_pct: times(num(fd?.returnOnAssets), 100),
    margin_laba_pct: times(num(fd?.profitMargins), 100),
    margin_operasi_pct: times(num(fd?.operatingMargins), 100),
    margin_kotor_pct: times(num(fd?.grossMargins), 100),

    pertumbuhan_pendapatan_pct: times(num(fd?.revenueGrowth), 100),
    pertumbuhan_laba_pct: times(num(fd?.earningsGrowth), 100),
    pertumbuhan_laba_kuartal_pct: times(num(ks?.earningsQuarterlyGrowth), 100),

    pendapatan: num(fd?.totalRevenue),
    kas: num(fd?.totalCash),
    utang: num(fd?.totalDebt),
    der: num(fd?.debtToEquity),
    current_ratio: num(fd?.currentRatio),
    arus_kas_operasi: num(fd?.operatingCashflow),

    dps_12m: dps12,
    yield_pct: dps12 !== null && harga ? (dps12 / harga) * 100 : null,
    payout_pct: times(num(sd?.payoutRatio), 100),
    tahun_berturut: streak,
    cagr_dps_pct: startDps > 0 && endDps > 0 ? ((endDps / startDps) ** (1 / 5) - 1) * 100 : null,
    ex_date: ex && !Number.isNaN(ex.getTime()) ? ex.toISOString() : null,
    dividen_tahunan: [...annual.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([tahun, dps]) => {
        const closes = (chart?.quotes ?? []).filter((q) => num(q.close) !== null && new Date(q.date).getUTCFullYear() === tahun);
        const ref = tahun === new Date(now).getUTCFullYear() ? harga : (closes.at(-1)?.close ?? null);
        return { tahun, dps, yield_pct: ref ? (dps / ref) * 100 : null };
      }),

    target_rata: num(fd?.targetMeanPrice),
    target_tinggi: num(fd?.targetHighPrice),
    target_rendah: num(fd?.targetLowPrice),
    rekomendasi: fd?.recommendationKey && fd.recommendationKey !== "none" ? fd.recommendationKey : null,
    jumlah_analis: num(fd?.numberOfAnalystOpinions),

    saham_beredar: num(ks?.sharesOutstanding) ?? num(quote.sharesOutstanding),
    float_saham: num(ks?.floatShares),
    insider_pct: times(num(ks?.heldPercentInsiders), 100),
    institusi_pct: times(num(ks?.heldPercentInstitutions), 100),

    riwayat_harga: (chart?.quotes ?? [])
      .filter((q) => num(q.close) !== null)
      .map((q) => ({ t: new Date(q.date).getTime(), c: q.close as number })),
    splits: ((chart?.events?.splits ?? []) as { date: Date | string | number; numerator?: number; denominator?: number; splitRatio?: string }[]).map((sp) => {
      const d = new Date(sp.date);
      const dStr = !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";
      const numVal = sp.numerator ?? 1;
      const denVal = sp.denominator ?? 1;
      return {
        tanggal: dStr,
        rasio: sp.splitRatio || `${numVal}:${denVal}`,
        faktor: denVal ? numVal / denVal : 1,
      };
    }),
    berita: await (async () => {
      const companyName = meta?.nama || quote.longName || quote.shortName || kode;
      const domesticNews = await fetchStockNews(kode, companyName).catch(() => []);
      const rawYahooNews = (
        ((searchRes as { news?: { uuid?: string; title?: string; publisher?: string; providerPublishTime?: Date | number; link?: string }[] })?.news ?? [])
      ).flatMap((n) => {
        const title = n.title?.trim();
        const url = n.link ? newsArticleUrl(n.link) : null;
        const publishedAt = n.providerPublishTime == null ? NaN : new Date(n.providerPublishTime).getTime();
        if (!title || !n.publisher || !url || !Number.isFinite(publishedAt)) return [];
        const { sentiment, sentimentLabel, ringkasanDampak, kategori } = classifyNewsSentiment(title);
        return [{
          id: n.uuid || url,
          judul: title,
          penerbit: n.publisher,
          tanggal: new Date(publishedAt).toLocaleDateString("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }),
          url,
          sentiment,
          sentimentLabel,
          ringkasanDampak,
          kategori,
        }];
      }).slice(0, 5);
      return [
        ...domesticNews,
        ...rawYahooNews.filter((yn) => !domesticNews.some((dn) => dn.judul.toLowerCase() === yn.judul.toLowerCase())),
      ].slice(0, 12);
    })(),
    corporate_actions: [
      ...(((chart?.events?.splits ?? []) as { date: Date | string | number; splitRatio?: string }[]).map((sp) => ({
        jenis: "SPLIT" as const,
        tanggal: new Date(sp.date).toISOString().slice(0, 10),
        judul: `Stock Split (${sp.splitRatio || "Pemecahan Saham"})`,
        keterangan: `Emiten melakukan stock split dengan rasio ${sp.splitRatio || "-"}.`,
      }))),
      ...(ex ? [{
        jenis: "DIVIDEN" as const,
        tanggal: ex.toISOString().slice(0, 10),
        judul: `Cum/Ex Date Dividen`,
        keterangan: dps12 ? `Estimasi dividen Rp ${Math.round(dps12).toLocaleString("id-ID")} per lembar saham.` : `Jadwal pembagian dividen emiten.`,
      }] : []),
    ],
  };

  const bandarmologi = computeBandarmologi(
    kode,
    harga,
    base.volume,
    base.perubahan_pct
  );

  const best_buy = computeBestBuy({
    kode,
    harga,
    hari_rendah: base.hari_rendah,
    hari_tinggi: base.hari_tinggi,
    ma50: base.ma50,
    bap: bandarmologi.brokerAvgPrice,
    perubahan_pct: base.perubahan_pct,
    topBuyerCode: bandarmologi.topBuyers[0]?.code,
  });

  const dividend_trap = computeDividendHunter({
    kode,
    harga,
    yield_pct: base.yield_pct,
    dps_12m: base.dps_12m,
    payout_pct: base.payout_pct,
    tahun_berturut: base.tahun_berturut,
    ex_date: base.ex_date,
    dividen_tahunan: base.dividen_tahunan,
    beta: base.beta,
    roe_pct: base.roe_pct,
    der: base.der,
  });

  const data: Detail = {
    ...base,
    analisis: analyze(base),
    bandarmologi,
    best_buy,
    dividend_trap,
  };
  detailCache.set(kode, { at: Date.now(), quoteAt: Date.now(), data });
  return data;
}
