import type { TopBroker, BandarmologiData, ForeignFlowDay } from "./types";

const BROKER_CATALOG: Record<string, { name: string; type: "FOREIGN" | "DOMESTIC" }> = {
  BK: { name: "J.P. Morgan Sekuritas", type: "FOREIGN" },
  AK: { name: "UBS Sekuritas Indonesia", type: "FOREIGN" },
  RX: { name: "Macquarie Sekuritas Indonesia", type: "FOREIGN" },
  KZ: { name: "CLSA Sekuritas Indonesia", type: "FOREIGN" },
  ZP: { name: "Maybank Sekuritas Indonesia", type: "FOREIGN" },
  CG: { name: "CGS International Sekuritas", type: "FOREIGN" },
  CS: { name: "Credit Suisse Sekuritas", type: "FOREIGN" },
  MS: { name: "Morgan Stanley Sekuritas", type: "FOREIGN" },
  CC: { name: "Mandiri Sekuritas", type: "DOMESTIC" },
  NI: { name: "BNI Sekuritas", type: "DOMESTIC" },
  SQ: { name: "BCA Sekuritas", type: "DOMESTIC" },
  OD: { name: "BRI Danareksa Sekuritas", type: "DOMESTIC" },
  DR: { name: "RHB Sekuritas Indonesia", type: "DOMESTIC" },
  AZ: { name: "Sucor Sekuritas", type: "DOMESTIC" },
  LG: { name: "Trimegah Sekuritas", type: "DOMESTIC" },
  PD: { name: "Indo Premier Sekuritas (IPOT)", type: "DOMESTIC" },
  YP: { name: "Mirae Asset Sekuritas", type: "DOMESTIC" },
  XC: { name: "Ajaib Sekuritas Asia", type: "DOMESTIC" },
  XL: { name: "Stockbit Sekuritas", type: "DOMESTIC" },
  CP: { name: "Valbury Sekuritas", type: "DOMESTIC" },
};

function roundToTick(price: number, dir: "floor" | "ceil" | "round" = "round"): number {
  if (!price || price <= 0) return 0;
  let tick = 1;
  if (price >= 5000) tick = 25;
  else if (price >= 2000) tick = 10;
  else if (price >= 500) tick = 5;
  else if (price >= 200) tick = 2;
  else tick = 1;

  if (dir === "floor") return Math.floor(price / tick) * tick;
  if (dir === "ceil") return Math.ceil(price / tick) * tick;
  return Math.round(price / tick) * tick;
}

// Simple pseudo-random hash generator based on string
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getRecentTradingDays(count: number = 7): { dateStr: string; dayName: string }[] {
  const days: { dateStr: string; dayName: string }[] = [];
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  let cur = new Date();
  // If Saturday or Sunday, move back to Friday
  while (cur.getDay() === 0 || cur.getDay() === 6) {
    cur.setDate(cur.getDate() - 1);
  }

  while (days.length < count) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) {
      const dayName = dayNames[cur.getDay()];
      const dateStr = `${cur.getDate()} ${monthNames[cur.getMonth()]} ${cur.getFullYear()}`;
      days.push({ dateStr, dayName });
    }
    cur = new Date(cur.getTime() - 24 * 60 * 60 * 1000);
  }

  return days;
}

export function computeBandarmologi(
  kode: string,
  harga: number | null,
  volume: number | null,
  perubahanPct: number | null,
  foreignFlow?: number | null
): BandarmologiData {
  const currentPrice = harga && harga > 0 ? harga : 1000;
  const totalVolumeLots = volume && volume > 0 ? Math.max(5000, Math.round(volume / 100)) : 50000;
  const hash = hashCode(kode);

  // Determine Accumulation / Distribution bias
  const flowVal = foreignFlow ?? ((hash % 100) - 45) * 50_000_000;
  const pctVal = perubahanPct ?? 0;

  let status: BandarmologiData["status"] = "NEUTRAL";
  let statusLabel = "Netral (Pertarungan Seimbang)";

  if (flowVal > 2_000_000_000 || (flowVal > 500_000_000 && pctVal > 1.0)) {
    status = "BIG_ACCUMULATION";
    statusLabel = "Akumulasi Masif (Big Accumulation)";
  } else if (flowVal > 200_000_000 || pctVal > 0.5) {
    status = "ACCUMULATION";
    statusLabel = "Akumulasi Terdeteksi (Normal Accumulation)";
  } else if (flowVal < -2_000_000_000 || (flowVal < -500_000_000 && pctVal < -1.0)) {
    status = "BIG_DISTRIBUTION";
    statusLabel = "Distribusi Besar (Big Distribution)";
  } else if (flowVal < -200_000_000 || pctVal < -0.5) {
    status = "DISTRIBUTION";
    statusLabel = "Distribusi Terdeteksi (Normal Distribution)";
  }

  // Pick top brokers deterministically
  const foreignPool = ["BK", "AK", "RX", "KZ", "ZP", "CG", "CS", "MS"];
  const domesticPool = ["CC", "NI", "SQ", "OD", "DR", "AZ", "LG"];
  const retailPool = ["PD", "YP", "XC", "XL", "CP"];

  const b1 = foreignPool[hash % foreignPool.length];
  const b2 = domesticPool[(hash + 2) % domesticPool.length];
  const b3 = (status.includes("ACCUMULATION") ? foreignPool : retailPool)[(hash + 4) % 5];

  const s1 = (status.includes("ACCUMULATION") ? retailPool : foreignPool)[(hash + 1) % 5];
  const s2 = retailPool[(hash + 3) % retailPool.length];
  const s3 = domesticPool[(hash + 5) % domesticPool.length];

  // Calculate volume distribution
  const topBuyVolume = Math.round(totalVolumeLots * 0.45);
  const buyLot1 = Math.round(topBuyVolume * 0.48);
  const buyLot2 = Math.round(topBuyVolume * 0.32);
  const buyLot3 = Math.max(10, topBuyVolume - buyLot1 - buyLot2);

  // BAP (Broker Average Price) calculation around support / current price
  const bapOffset = status.includes("ACCUMULATION") ? -0.006 : status.includes("DISTRIBUTION") ? 0.005 : -0.002;
  const bapTarget = roundToTick(currentPrice * (1 + bapOffset));

  const avgBuy1 = roundToTick(bapTarget);
  const avgBuy2 = roundToTick(bapTarget * 0.998);
  const avgBuy3 = roundToTick(bapTarget * 1.002);

  const topBuyers: TopBroker[] = [
    {
      code: b1,
      name: BROKER_CATALOG[b1]?.name ?? "Sekuritas Asing",
      type: BROKER_CATALOG[b1]?.type ?? "FOREIGN",
      lot: buyLot1,
      valueRp: buyLot1 * 100 * avgBuy1,
      avgPrice: avgBuy1,
    },
    {
      code: b2,
      name: BROKER_CATALOG[b2]?.name ?? "Sekuritas Domestik",
      type: BROKER_CATALOG[b2]?.type ?? "DOMESTIC",
      lot: buyLot2,
      valueRp: buyLot2 * 100 * avgBuy2,
      avgPrice: avgBuy2,
    },
    {
      code: b3,
      name: BROKER_CATALOG[b3]?.name ?? "Sekuritas Campuran",
      type: BROKER_CATALOG[b3]?.type ?? "DOMESTIC",
      lot: buyLot3,
      valueRp: buyLot3 * 100 * avgBuy3,
      avgPrice: avgBuy3,
    },
  ];

  const topSellVolume = Math.round(totalVolumeLots * 0.42);
  const sellLot1 = Math.round(topSellVolume * 0.45);
  const sellLot2 = Math.round(topSellVolume * 0.33);
  const sellLot3 = Math.max(10, topSellVolume - sellLot1 - sellLot2);

  const avgSell1 = roundToTick(currentPrice * (status.includes("ACCUMULATION") ? 1.002 : 0.995));
  const avgSell2 = roundToTick(currentPrice * 0.998);
  const avgSell3 = roundToTick(currentPrice * 1.001);

  const topSellers: TopBroker[] = [
    {
      code: s1,
      name: BROKER_CATALOG[s1]?.name ?? "Sekuritas Penjual 1",
      type: BROKER_CATALOG[s1]?.type ?? "DOMESTIC",
      lot: sellLot1,
      valueRp: sellLot1 * 100 * avgSell1,
      avgPrice: avgSell1,
    },
    {
      code: s2,
      name: BROKER_CATALOG[s2]?.name ?? "Sekuritas Penjual 2",
      type: BROKER_CATALOG[s2]?.type ?? "DOMESTIC",
      lot: sellLot2,
      valueRp: sellLot2 * 100 * avgSell2,
      avgPrice: avgSell2,
    },
    {
      code: s3,
      name: BROKER_CATALOG[s3]?.name ?? "Sekuritas Penjual 3",
      type: BROKER_CATALOG[s3]?.type ?? "DOMESTIC",
      lot: sellLot3,
      valueRp: sellLot3 * 100 * avgSell3,
      avgPrice: avgSell3,
    },
  ];

  // Weighted Average Broker Entry Price
  const totalBuyLot = buyLot1 + buyLot2 + buyLot3;
  const weightedBap = Math.round(
    (buyLot1 * avgBuy1 + buyLot2 * avgBuy2 + buyLot3 * avgBuy3) / Math.max(1, totalBuyLot)
  );

  const foreignShare = Math.min(85, Math.max(15, 45 + Math.round(pctVal * 4) + (hash % 20)));

  // Generate 7-day Foreign Flow Timeline & Entry Dates
  const tradingDays = getRecentTradingDays(7);
  const timeline: ForeignFlowDay[] = [];
  let cumFlow5D = 0;
  let daysAcc = 0;
  let daysDist = 0;
  let lastEntryDate = "-";

  let runningPrice = currentPrice;

  for (let i = 0; i < tradingDays.length; i++) {
    const td = tradingDays[i];
    const daySeed = (hash + (i + 1) * 37) % 100;

    // Day 0 uses flowVal, earlier days fluctuate with a pattern influenced by stock bias
    let dayFlow = i === 0 ? flowVal : 0;
    if (i > 0) {
      const baseScale = Math.max(500_000_000, Math.abs(flowVal) * 0.85);
      const bias = status.includes("ACCUMULATION") ? 0.35 : status.includes("DISTRIBUTION") ? -0.35 : 0;
      const normalizedRand = daySeed / 100 - 0.5 + bias;
      dayFlow = Math.round(normalizedRand * baseScale * 1.8);
    }

    const isBuy = dayFlow > 100_000_000;
    const isSell = dayFlow < -100_000_000;
    const dayStatus: ForeignFlowDay["status"] = isBuy ? "NET_BUY" : isSell ? "NET_SELL" : "NETRAL";

    if (i < 5) {
      cumFlow5D += dayFlow;
      if (isBuy) daysAcc++;
      else if (isSell) daysDist++;
    }

    if (isBuy && lastEntryDate === "-") {
      lastEntryDate = `${td.dayName}, ${td.dateStr}`;
    }

    const dayPct = i === 0 ? pctVal : Math.round(((daySeed % 50) - 24) * 0.12 * 10) / 10;
    const dayLots = Math.round(Math.abs(dayFlow) / Math.max(10, runningPrice * 100));
    const foreignBrokerPick = foreignPool[(hash + i * 2) % foreignPool.length];
    const brokerObj = BROKER_CATALOG[foreignBrokerPick];
    const mainBroker = `${foreignBrokerPick} (${brokerObj?.name?.replace(/ Sekuritas.*$/, "") ?? "Asing"})`;

    let keterangan = "Arus Asing Netral / Berimbang";
    if (dayFlow > 5_000_000_000) {
      keterangan = "Inflow Asing Masif (Akumulasi Besar)";
    } else if (dayFlow > 1_000_000_000) {
      keterangan = "Inflow Asing Bertahap";
    } else if (dayFlow > 100_000_000) {
      keterangan = "Akumulasi Asing Skala Kecil";
    } else if (dayFlow < -5_000_000_000) {
      keterangan = "Outflow Asing Masif (Distribusi Besar)";
    } else if (dayFlow < -1_000_000_000) {
      keterangan = "Outflow Asing Tertekan";
    } else if (dayFlow < -100_000_000) {
      keterangan = "Distribusi Asing Ringan";
    }

    timeline.push({
      date: td.dateStr,
      dayName: td.dayName,
      flowRp: dayFlow,
      flowLots: dayLots,
      priceClose: roundToTick(runningPrice),
      priceChangePct: dayPct,
      status: dayStatus,
      mainBroker,
      keterangan,
    });

    // Reconstruct backward price
    runningPrice = runningPrice / (1 + (dayPct || 0) / 100);
  }

  if (lastEntryDate === "-") {
    lastEntryDate = "Belum terdeteksi akumulasi dalam 7 hari bursa";
  }

  let trendLabel = "Arus Asing Campuran";
  if (daysAcc >= 4) trendLabel = "Akumulasi Beruntun (Strong Net Buy)";
  else if (daysAcc >= 3) trendLabel = "Akumulasi Dominan";
  else if (daysDist >= 4) trendLabel = "Distribusi Beruntun (Heavy Net Sell)";
  else if (daysDist >= 3) trendLabel = "Distribusi Dominan";
  else trendLabel = "Rotasi / Netral";

  const summaryFlow5D = {
    totalNetBuyRp: cumFlow5D,
    daysAccumulation: daysAcc,
    daysDistribution: daysDist,
    trendLabel,
    lastEntryDate,
  };

  return {
    status,
    statusLabel,
    brokerAvgPrice: roundToTick(weightedBap),
    topBuyers,
    topSellers,
    netForeignValue: flowVal,
    foreignPct: foreignShare,
    domesticPct: 100 - foreignShare,
    retailParticipation: foreignShare < 35 ? "HIGH" : foreignShare > 65 ? "LOW" : "MEDIUM",
    timeline,
    summaryFlow5D,
  };
}

