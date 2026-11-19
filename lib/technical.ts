export type TechnicalIndicatorResult = {
  name: string;
  value: string;
  action: "BELI" | "JUAL" | "NETRAL";
  detail: string;
};

export type TechnicalSummary = {
  overall: "SANGAT BULLISH" | "BULLISH" | "NETRAL" | "BEARISH" | "SANGAT BEARISH";
  skor: number; // 0 (sangat bearish) hingga 100 (sangat bullish)
  buyCount: number;
  neutralCount: number;
  sellCount: number;
  rsi: { value: number | null; status: "Oversold" | "Overbought" | "Netral" | "N/A"; action: "BELI" | "JUAL" | "NETRAL" };
  macd: {
    macd: number | null;
    signal: number | null;
    hist: number | null;
    status: "Bullish" | "Bearish" | "Netral" | "N/A";
    action: "BELI" | "JUAL" | "NETRAL";
  };
  ma: {
    ma20: number | null;
    ma50: number | null;
    ma200: number | null;
    goldenCross: boolean | null;
    deathCross: boolean | null;
  };
  indicators: TechnicalIndicatorResult[];
};

function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const emaArr: number[] = [];

  // Start with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let currentEma = sum / period;
  emaArr.push(currentEma);

  for (let i = period; i < values.length; i++) {
    currentEma = values[i] * k + currentEma * (1 - k);
    emaArr.push(currentEma);
  }
  return emaArr;
}

export function calculateRSI(prices: number[], period = 14): {
  value: number | null;
  status: "Oversold" | "Overbought" | "Netral" | "N/A";
  action: "BELI" | "JUAL" | "NETRAL";
} {
  if (!prices || prices.length < period + 1) {
    return { value: null, status: "N/A", action: "NETRAL" };
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) {
    return { value: 100, status: "Overbought", action: "JUAL" };
  }

  const rs = avgGain / avgLoss;
  const rsi = Math.round((100 - 100 / (1 + rs)) * 10) / 10;

  let status: "Oversold" | "Overbought" | "Netral" = "Netral";
  let action: "BELI" | "JUAL" | "NETRAL" = "NETRAL";

  if (rsi <= 30) {
    status = "Oversold";
    action = "BELI";
  } else if (rsi >= 70) {
    status = "Overbought";
    action = "JUAL";
  }

  return { value: rsi, status, action };
}

export function calculateMACD(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): {
  macd: number | null;
  signal: number | null;
  hist: number | null;
  status: "Bullish" | "Bearish" | "Netral" | "N/A";
  action: "BELI" | "JUAL" | "NETRAL";
} {
  if (!prices || prices.length < slowPeriod + signalPeriod) {
    return { macd: null, signal: null, hist: null, status: "N/A", action: "NETRAL" };
  }

  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  // MACD line is fastEMA - slowEMA aligned at same trailing index
  const offset = slowPeriod - fastPeriod;
  const macdLine: number[] = [];
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + offset] - slowEMA[i]);
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);
  if (!signalLine.length) {
    return { macd: null, signal: null, hist: null, status: "N/A", action: "NETRAL" };
  }

  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const lastHist = lastMacd - lastSignal;

  let status: "Bullish" | "Bearish" | "Netral" = "Netral";
  let action: "BELI" | "JUAL" | "NETRAL" = "NETRAL";

  if (lastHist > 0) {
    status = "Bullish";
    action = "BELI";
  } else if (lastHist < 0) {
    status = "Bearish";
    action = "JUAL";
  }

  return {
    macd: Math.round(lastMacd * 100) / 100,
    signal: Math.round(lastSignal * 100) / 100,
    hist: Math.round(lastHist * 100) / 100,
    status,
    action,
  };
}

function calculateSMA(prices: number[], period: number): number | null {
  if (!prices || prices.length < period) return null;
  const slice = prices.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Math.round(sum / period);
}

export function analyzeTechnicals(
  priceHistory: { t: number; c: number }[],
  currentPrice: number | null
): TechnicalSummary {
  const prices = priceHistory.map((p) => p.c).filter((v) => typeof v === "number" && !isNaN(v));
  const cur = currentPrice ?? (prices.length ? prices[prices.length - 1] : null);

  const rsi = calculateRSI(prices, 14);
  const macd = calculateMACD(prices, 12, 26, 9);
  const ma20 = calculateSMA(prices, 20);
  const ma50 = calculateSMA(prices, 50);
  const ma200 = calculateSMA(prices, 200);

  const goldenCross = ma50 !== null && ma200 !== null ? ma50 > ma200 : null;
  const deathCross = ma50 !== null && ma200 !== null ? ma50 < ma200 : null;

  const indicators: TechnicalIndicatorResult[] = [];

  // RSI
  if (rsi.value !== null) {
    indicators.push({
      name: "RSI (14)",
      value: String(rsi.value),
      action: rsi.action,
      detail:
        rsi.status === "Oversold"
          ? "RSI jenuh jual (<30), indikasi pembalikan naik"
          : rsi.status === "Overbought"
          ? "RSI jenuh beli (>70), indikasi koreksi harga"
          : "RSI dalam rentang netral (30 - 70)",
    });
  }

  // MACD
  if (macd.macd !== null && macd.signal !== null) {
    indicators.push({
      name: "MACD (12, 26, 9)",
      value: `MACD ${macd.macd} / Sig ${macd.signal}`,
      action: macd.action,
      detail:
        macd.status === "Bullish"
          ? "Garis MACD di atas Signal (momentum naik)"
          : "Garis MACD di bawah Signal (momentum turun)",
    });
  }

  // MA 20
  if (ma20 !== null && cur !== null) {
    const isAbove = cur >= ma20;
    indicators.push({
      name: "MA 20 (Jangka Pendek)",
      value: `Rp ${ma20.toLocaleString("id-ID")}`,
      action: isAbove ? "BELI" : "JUAL",
      detail: isAbove ? "Harga di atas MA20 (tren jangka pendek naik)" : "Harga di bawah MA20",
    });
  }

  // MA 50
  if (ma50 !== null && cur !== null) {
    const isAbove = cur >= ma50;
    indicators.push({
      name: "MA 50 (Jangka Menengah)",
      value: `Rp ${ma50.toLocaleString("id-ID")}`,
      action: isAbove ? "BELI" : "JUAL",
      detail: isAbove ? "Harga di atas MA50 (tren jangka menengah positif)" : "Harga di bawah MA50",
    });
  }

  // MA 200
  if (ma200 !== null && cur !== null) {
    const isAbove = cur >= ma200;
    indicators.push({
      name: "MA 200 (Jangka Panjang)",
      value: `Rp ${ma200.toLocaleString("id-ID")}`,
      action: isAbove ? "BELI" : "JUAL",
      detail: isAbove ? "Harga di atas MA200 (tren bull jangka panjang)" : "Harga di bawah MA200 (bearish)",
    });
  }

  // Golden / Death Cross
  if (ma50 !== null && ma200 !== null) {
    indicators.push({
      name: "Golden / Death Cross",
      value: goldenCross ? "Golden Cross" : "Death Cross",
      action: goldenCross ? "BELI" : "JUAL",
      detail: goldenCross ? "MA50 melintas di atas MA200 (sinyal bullish kuat)" : "MA50 di bawah MA200",
    });
  }

  const buyCount = indicators.filter((i) => i.action === "BELI").length;
  const sellCount = indicators.filter((i) => i.action === "JUAL").length;
  const neutralCount = indicators.filter((i) => i.action === "NETRAL").length;
  const total = indicators.length || 1;

  const skor = Math.round(((buyCount * 1 + neutralCount * 0.5) / total) * 100);

  let overall: "SANGAT BULLISH" | "BULLISH" | "NETRAL" | "BEARISH" | "SANGAT BEARISH" = "NETRAL";
  if (skor >= 80) overall = "SANGAT BULLISH";
  else if (skor >= 60) overall = "BULLISH";
  else if (skor >= 40) overall = "NETRAL";
  else if (skor >= 20) overall = "BEARISH";
  else overall = "SANGAT BEARISH";

  return {
    overall,
    skor,
    buyCount,
    neutralCount,
    sellCount,
    rsi,
    macd,
    ma: { ma20, ma50, ma200, goldenCross, deathCross },
    indicators,
  };
}

