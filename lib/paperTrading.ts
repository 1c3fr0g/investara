"use client";

import { useEffect, useState, useSyncExternalStore, useCallback, useRef } from "react";
import type { OfflineFill } from "./paperOffline";
import type { ListResponse } from "./types";

export type TradeStatus = "OPEN" | "TP1_HIT" | "TP2_HIT" | "SL_HIT" | "CLOSED";

export interface PaperTrade {
  id: string;
  kode: string;
  nama: string;
  entryDate: string; // ISO string
  entryPrice: number;
  lot: number;
  shares: number; // lot * 100
  totalInvested: number; // shares * entryPrice

  targetTp1: number; // e.g. +1.5%
  targetTp1Pct: number;
  targetTp2: number; // e.g. +3.0%
  targetTp2Pct: number;
  stopLoss: number; // e.g. -2.0%
  stopLossPct: number;

  convictionScore: number;
  isMsci?: boolean;
  notes?: string;
  batchTag?: string;

  status: TradeStatus;
  exitDate?: string;
  exitPrice?: number;
  realizedPnlRp?: number;
  realizedPnlPct?: number;

  highestPrice?: number;
  lowestPrice?: number;
  currentPrice?: number;
  quoteAt?: number;
  unrealizedPnlRp?: number;
  unrealizedPnlPct?: number;
}

export interface PaperTradingSummary {
  startingBalance: number;
  availableCash: number;
  investedCash: number;
  portfolioValue: number;
  totalTrades: number;
  openTradesCount: number;
  closedTradesCount: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  totalRealizedPnlRp: number;
  totalRealizedPnlPct: number;
  totalUnrealizedPnlRp: number;
  profitFactor: number;
}

export interface DailyPerformance {
  dateStr: string; // "YYYY-MM-DD"
  dateLabel: string; // e.g. "10 Nov 2026"
  totalTrades: number;
  openCount: number;
  closedCount: number;
  winningCount: number;
  losingCount: number;
  winRatePct: number;
  realizedPnlRp: number;
  unrealizedPnlRp: number;
  trades: PaperTrade[];
  batchTags: string[];
  status: "PROFIT" | "LOSS" | "ACTIVE" | "NEUTRAL";
}

export interface BatchPerformance {
  batchTag: string;
  startDate: string;
  endDate?: string;
  totalTrades: number;
  openCount: number;
  closedCount: number;
  winningCount: number;
  losingCount: number;
  winRatePct: number;
  realizedPnlRp: number;
  realizedPnlPct: number;
  unrealizedPnlRp: number;
  isComplete: boolean;
  trades: PaperTrade[];
}

const STORAGE_KEY = "investara_paper_trades";
const BALANCE_KEY = "investara_paper_starting_balance";
const DEFAULT_STARTING_BALANCE = 50_000_000; // Rp 50 Juta
const EMPTY_SERVER_TRADES: PaperTrade[] = [];

// In-memory cache for useSyncExternalStore
let cachedTrades: PaperTrade[] = [];
let cachedBalance: number = DEFAULT_STARTING_BALANCE;
let isLoaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("investara_paper_trades_updated"));
  }
}

function loadFromStorage(): PaperTrade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const trades: PaperTrade[] = JSON.parse(raw);
    return trades.filter((trade) => trade.id !== "pt_seed_bbca" && trade.id !== "pt_seed_tlkm");
  } catch (e) {
    console.error("Failed to parse paper trades from localStorage", e);
    return [];
  }
}

function loadBalanceFromStorage(): number {
  if (typeof window === "undefined") return DEFAULT_STARTING_BALANCE;
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    return raw ? Number(raw) || DEFAULT_STARTING_BALANCE : DEFAULT_STARTING_BALANCE;
  } catch {
    return DEFAULT_STARTING_BALANCE;
  }
}

function ensureLoaded() {
  if (!isLoaded && typeof window !== "undefined") {
    cachedTrades = loadFromStorage();
    cachedBalance = loadBalanceFromStorage();
    isLoaded = true;
  }
}

export function getPaperTrades(): PaperTrade[] {
  ensureLoaded();
  return cachedTrades;
}

export function savePaperTrades(trades: PaperTrade[]) {
  cachedTrades = trades;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    } catch (e) {
      console.error("Failed to save paper trades to localStorage", e);
    }
  }
  notify();
}

export function applyOfflinePaperFills(fills: OfflineFill[]) {
  if (!fills.length) return;
  const byId = new Map(fills.map((fill) => [fill.id, fill]));
  let changed = false;
  const trades = getPaperTrades().map((trade) => {
    const fill = byId.get(trade.id);
    if (!fill || (trade.status !== "OPEN" && !(fill.exitAt < Date.parse(trade.exitDate ?? "")))) return trade;
    const pnl = fill.exitPrice - trade.entryPrice;
    changed = true;
    return {
      ...trade,
      status: fill.status,
      exitDate: new Date(fill.exitAt).toISOString(),
      exitPrice: fill.exitPrice,
      currentPrice: fill.exitPrice,
      highestPrice: Math.max(trade.highestPrice ?? trade.entryPrice, fill.exitPrice),
      lowestPrice: Math.min(trade.lowestPrice ?? trade.entryPrice, fill.exitPrice),
      realizedPnlRp: pnl * trade.shares,
      realizedPnlPct: Number(((pnl / trade.entryPrice) * 100).toFixed(2)),
      unrealizedPnlRp: 0,
      unrealizedPnlPct: 0,
    };
  });
  if (changed) savePaperTrades(trades);
}

export function getStartingBalance(): number {
  ensureLoaded();
  return cachedBalance;
}

export function setStartingBalance(balance: number) {
  cachedBalance = balance;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(BALANCE_KEY, String(balance));
    } catch (e) {
      console.error("Failed to save starting balance", e);
    }
  }
  notify();
}

export function openPaperTrade(params: {
  kode: string;
  nama: string;
  entryPrice: number;
  lot?: number;
  convictionScore?: number;
  isMsci?: boolean;
  notes?: string;
  targetTp1Pct?: number;
  targetTp2Pct?: number;
  stopLossPct?: number;
}): PaperTrade | null {
  ensureLoaded();
  const lot = params.lot ?? 10;
  if (!Number.isSafeInteger(lot) || lot < 1 || !Number.isFinite(params.entryPrice) || params.entryPrice < 2) return null;
  const shares = lot * 100;
  const entryPrice = Math.max(1, Math.round(params.entryPrice));
  const totalInvested = shares * entryPrice;

  const tp1Pct = params.targetTp1Pct ?? 1.5;
  const tp2Pct = params.targetTp2Pct ?? 3.0;
  const slPct = params.stopLossPct ?? -2.0;
  if (![tp1Pct, tp2Pct, slPct].every(Number.isFinite) || tp1Pct <= 0 || tp2Pct < tp1Pct || slPct >= 0 || slPct <= -100
    || totalInvested > calculateSummary(cachedTrades, cachedBalance).availableCash) return null;

  const targetTp1 = Math.max(entryPrice + 1, Math.round(entryPrice * (1 + tp1Pct / 100)));
  const targetTp2 = Math.max(targetTp1, Math.round(entryPrice * (1 + tp2Pct / 100)));
  const stopLoss = Math.min(entryPrice - 1, Math.max(1, Math.round(entryPrice * (1 + slPct / 100))));

  const newTrade: PaperTrade = {
    id: `pt_${crypto.randomUUID()}`,
    kode: params.kode.toUpperCase(),
    nama: params.nama,
    entryDate: new Date().toISOString(),
    entryPrice,
    lot,
    shares,
    totalInvested,
    targetTp1,
    targetTp1Pct: tp1Pct,
    targetTp2,
    targetTp2Pct: tp2Pct,
    stopLoss,
    stopLossPct: slPct,
    convictionScore: params.convictionScore ?? 85,
    isMsci: params.isMsci ?? false,
    notes: params.notes,
    status: "OPEN",
    highestPrice: entryPrice,
    lowestPrice: entryPrice,
    currentPrice: entryPrice,
    unrealizedPnlRp: 0,
    unrealizedPnlPct: 0,
  };

  const updated = [newTrade, ...cachedTrades];
  savePaperTrades(updated);
  return newTrade;
}

export function openBatchPaperTrades(
  items: {
    kode: string;
    nama: string;
    entryPrice: number;
    lot?: number;
    convictionScore?: number;
    isMsci?: boolean;
    notes?: string;
  }[],
  batchTag?: string
): number {
  ensureLoaded();
  const existingKodes = new Set(cachedTrades.filter((t) => t.status === "OPEN").map((t) => t.kode));
  const newTrades: PaperTrade[] = [];
  let remainingCash = calculateSummary(cachedTrades, cachedBalance).availableCash;
  const tag =
    batchTag ||
    `Batch Swing ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  for (const item of items) {
    if (!item.kode) continue;
    const kodeUpper = item.kode.toUpperCase();
    if (existingKodes.has(kodeUpper)) continue;
    if (!Number.isFinite(item.entryPrice) || item.entryPrice < 2) continue;

    const lot = item.lot ?? Math.max(5, Math.min(100, Math.round(5_000_000 / (item.entryPrice * 100))));
    if (!Number.isSafeInteger(lot) || lot < 1) continue;
    const shares = lot * 100;
    const entryPrice = Math.round(item.entryPrice);
    const totalInvested = shares * entryPrice;
    if (totalInvested > remainingCash) continue;
    remainingCash -= totalInvested;
    existingKodes.add(kodeUpper);

    const targetTp1 = Math.max(entryPrice + 1, Math.round(entryPrice * 1.015));
    const targetTp2 = Math.max(targetTp1, Math.round(entryPrice * 1.03));
    const stopLoss = Math.min(entryPrice - 1, Math.round(entryPrice * 0.98));

    newTrades.push({
      id: `pt_${crypto.randomUUID()}`,
      kode: kodeUpper,
      nama: item.nama || `${kodeUpper} Tbk`,
      entryDate: new Date().toISOString(),
      entryPrice,
      lot,
      shares,
      totalInvested,
      targetTp1,
      targetTp1Pct: 1.5,
      targetTp2,
      targetTp2Pct: 3.0,
      stopLoss,
      stopLossPct: -2.0,
      convictionScore: item.convictionScore ?? 85,
      isMsci: item.isMsci ?? false,
      notes: item.notes || `Radar Swing ${item.convictionScore ?? 85}%`,
      batchTag: tag,
      status: "OPEN",
      highestPrice: entryPrice,
      lowestPrice: entryPrice,
      currentPrice: entryPrice,
      unrealizedPnlRp: 0,
      unrealizedPnlPct: 0,
    });
  }

  if (newTrades.length > 0) {
    savePaperTrades([...newTrades, ...cachedTrades]);
  }

  return newTrades.length;
}

export function closePaperTrade(id: string): PaperTrade | null {
  ensureLoaded();
  let closedItem: PaperTrade | null = null;

  const updated = cachedTrades.map((t) => {
    if (t.id === id && t.status === "OPEN") {
      const price = t.currentPrice ?? t.entryPrice;
      const realizedPnlRp = (price - t.entryPrice) * t.shares;
      const realizedPnlPct = Number((((price - t.entryPrice) / t.entryPrice) * 100).toFixed(2));
      closedItem = {
        ...t,
        status: "CLOSED",
        exitDate: new Date().toISOString(),
        exitPrice: price,
        realizedPnlRp,
        realizedPnlPct,
        unrealizedPnlRp: 0,
        unrealizedPnlPct: 0,
      };
      return closedItem;
    }
    return t;
  });

  if (closedItem) {
    savePaperTrades(updated);
  }
  return closedItem;
}

export function closeAllPaperTrades(): { count: number; totalPnlRp: number } {
  ensureLoaded();
  let count = 0;
  let totalPnlRp = 0;

  const updated = cachedTrades.map((t): PaperTrade => {
    if (t.status === "OPEN") {
      const price = t.currentPrice ?? t.entryPrice;
      const realizedPnlRp = (price - t.entryPrice) * t.shares;
      const realizedPnlPct = Number((((price - t.entryPrice) / t.entryPrice) * 100).toFixed(2));
      count++;
      totalPnlRp += realizedPnlRp;

      return {
        ...t,
        status: "CLOSED",
        exitDate: new Date().toISOString(),
        exitPrice: price,
        realizedPnlRp,
        realizedPnlPct,
        unrealizedPnlRp: 0,
        unrealizedPnlPct: 0,
      };
    }
    return t;
  });

  if (count > 0) {
    savePaperTrades(updated);
  }
  return { count, totalPnlRp };
}

export function deletePaperTrade(id: string) {
  ensureLoaded();
  const updated = cachedTrades.filter((t) => t.id !== id);
  savePaperTrades(updated);
}

export function resetPaperTrades() {
  savePaperTrades([]);
}

type PaperQuote = { price: number; at: number };

export function evaluateTradesWithLivePrices(
  trades: PaperTrade[],
  quotes: ReadonlyMap<string, PaperQuote>,
  now = Date.now(),
) {
  let hasChanges = false;
  let checked = 0;
  let closed = 0;

  const updatedTrades = trades.map((t) => {
    if (t.status !== "OPEN") return t;
    const quote = quotes.get(t.kode);
    const entryAt = Date.parse(t.entryDate);
    if (!quote || !Number.isFinite(quote.price) || quote.price <= 0 || !Number.isFinite(quote.at)
      || !Number.isFinite(entryAt) || quote.at < entryAt || quote.at < (t.quoteAt ?? 0) || quote.at > now) return t;
    const live = quote.price;
    checked++;

    let nextStatus: TradeStatus = "OPEN";
    let exitPrice: number | undefined;

    const highest = Math.max(t.highestPrice ?? t.entryPrice, live);
    const lowest = Math.min(t.lowestPrice ?? t.entryPrice, live);

    if (live >= t.targetTp2) {
      nextStatus = "TP2_HIT";
      exitPrice = t.targetTp2;
    } else if (live <= t.stopLoss) {
      nextStatus = "SL_HIT";
      exitPrice = t.stopLoss;
    } else if (live >= t.targetTp1) {
      nextStatus = "TP1_HIT";
      exitPrice = t.targetTp1;
    }

    if (exitPrice !== undefined) {
      const pnlPerShare = exitPrice - t.entryPrice;
      hasChanges = true;
      closed++;
      return {
        ...t,
        status: nextStatus,
        exitDate: new Date(quote.at).toISOString(),
        exitPrice,
        realizedPnlRp: pnlPerShare * t.shares,
        realizedPnlPct: Number(((pnlPerShare / t.entryPrice) * 100).toFixed(2)),
        highestPrice: highest,
        lowestPrice: lowest,
        currentPrice: live,
        quoteAt: quote.at,
        unrealizedPnlRp: 0,
        unrealizedPnlPct: 0,
      };
    }

    // Still OPEN, update mark-to-market
    const unrealizedPnlRp = (live - t.entryPrice) * t.shares;
    const unrealizedPnlPct = Number((((live - t.entryPrice) / t.entryPrice) * 100).toFixed(2));

    if (
      t.currentPrice !== live ||
      t.quoteAt !== quote.at ||
      t.highestPrice !== highest ||
      t.lowestPrice !== lowest ||
      t.unrealizedPnlRp !== unrealizedPnlRp
    ) {
      hasChanges = true;
      return {
        ...t,
        currentPrice: live,
        quoteAt: quote.at,
        highestPrice: highest,
        lowestPrice: lowest,
        unrealizedPnlRp,
        unrealizedPnlPct,
      };
    }

    return t;
  });

  return { updatedTrades, hasChanges, checked, closed };
}

export function calculateSummary(
  trades: PaperTrade[],
  startingBalance: number
): PaperTradingSummary {
  let investedCash = 0;
  let totalRealizedPnlRp = 0;
  let totalUnrealizedPnlRp = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  let openTradesCount = 0;
  let closedTradesCount = 0;

  for (const t of trades) {
    if (t.status === "OPEN") {
      openTradesCount++;
      investedCash += t.totalInvested;
      totalUnrealizedPnlRp += t.unrealizedPnlRp ?? 0;
    } else {
      closedTradesCount++;
      const pnl = t.realizedPnlRp ?? 0;
      totalRealizedPnlRp += pnl;
      if (pnl > 0) {
        winningTrades++;
        grossProfit += pnl;
      } else if (pnl < 0) {
        losingTrades++;
        grossLoss += Math.abs(pnl);
      }
    }
  }

  const availableCash = startingBalance - investedCash + totalRealizedPnlRp;
  const portfolioValue = availableCash + investedCash + totalUnrealizedPnlRp;
  const totalTrades = trades.length;
  const winRatePct =
    closedTradesCount > 0 ? Number(((winningTrades / closedTradesCount) * 100).toFixed(1)) : 0;
  const totalRealizedPnlPct =
    startingBalance > 0 ? Number(((totalRealizedPnlRp / startingBalance) * 100).toFixed(2)) : 0;
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? Infinity : 0;

  return {
    startingBalance,
    availableCash,
    investedCash,
    portfolioValue,
    totalTrades,
    openTradesCount,
    closedTradesCount,
    winningTrades,
    losingTrades,
    winRatePct,
    totalRealizedPnlRp,
    totalRealizedPnlPct,
    totalUnrealizedPnlRp,
    profitFactor,
  };
}

export function getDailyPerformanceMap(trades: PaperTrade[]): Record<string, DailyPerformance> {
  const map: Record<string, DailyPerformance> = {};

  for (const t of trades) {
    // If closed, attribute to exitDate (day of realization); if open, attribute to entryDate
    const targetIso = t.exitDate || t.entryDate;
    if (!targetIso) continue;

    const d = new Date(targetIso);
    if (isNaN(d.getTime())) continue;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;

    if (!map[dateStr]) {
      const dateLabel = d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      map[dateStr] = {
        dateStr,
        dateLabel,
        totalTrades: 0,
        openCount: 0,
        closedCount: 0,
        winningCount: 0,
        losingCount: 0,
        winRatePct: 0,
        realizedPnlRp: 0,
        unrealizedPnlRp: 0,
        trades: [],
        batchTags: [],
        status: "NEUTRAL",
      };
    }

    const item = map[dateStr];
    item.totalTrades++;
    item.trades.push(t);
    if (t.batchTag && !item.batchTags.includes(t.batchTag)) {
      item.batchTags.push(t.batchTag);
    }

    if (t.status === "OPEN") {
      item.openCount++;
      item.unrealizedPnlRp += t.unrealizedPnlRp ?? 0;
    } else {
      item.closedCount++;
      const pnl = t.realizedPnlRp ?? 0;
      item.realizedPnlRp += pnl;
      if (pnl > 0) item.winningCount++;
      else if (pnl < 0) item.losingCount++;
    }
  }

  // Calculate win rates and status
  for (const dateStr of Object.keys(map)) {
    const item = map[dateStr];
    if (item.closedCount > 0) {
      item.winRatePct = Number(((item.winningCount / item.closedCount) * 100).toFixed(1));
      if (item.realizedPnlRp > 0) item.status = "PROFIT";
      else if (item.realizedPnlRp < 0) item.status = "LOSS";
      else item.status = "NEUTRAL";
    } else if (item.openCount > 0) {
      item.status = "ACTIVE";
    }
  }

  return map;
}

export function getBatchPerformanceList(trades: PaperTrade[]): BatchPerformance[] {
  const groups: Record<string, PaperTrade[]> = {};

  for (const t of trades) {
    const tag =
      t.batchTag ||
      `Batch ${new Date(t.entryDate).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`;

    if (!groups[tag]) groups[tag] = [];
    groups[tag].push(t);
  }

  const results: BatchPerformance[] = [];

  for (const [tag, bTrades] of Object.entries(groups)) {
    let openCount = 0;
    let closedCount = 0;
    let winningCount = 0;
    let losingCount = 0;
    let realizedPnlRp = 0;
    let totalInvested = 0;
    let unrealizedPnlRp = 0;
    let minEntryDate = bTrades[0]?.entryDate || "";
    let maxExitDate: string | undefined = undefined;

    for (const t of bTrades) {
      totalInvested += t.totalInvested;
      if (t.entryDate < minEntryDate) minEntryDate = t.entryDate;

      if (t.status === "OPEN") {
        openCount++;
        unrealizedPnlRp += t.unrealizedPnlRp ?? 0;
      } else {
        closedCount++;
        const pnl = t.realizedPnlRp ?? 0;
        realizedPnlRp += pnl;
        if (pnl > 0) winningCount++;
        else if (pnl < 0) losingCount++;

        if (t.exitDate && (!maxExitDate || t.exitDate > maxExitDate)) {
          maxExitDate = t.exitDate;
        }
      }
    }

    const winRatePct =
      closedCount > 0 ? Number(((winningCount / closedCount) * 100).toFixed(1)) : 0;
    const realizedPnlPct =
      totalInvested > 0 ? Number(((realizedPnlRp / totalInvested) * 100).toFixed(2)) : 0;

    results.push({
      batchTag: tag,
      startDate: minEntryDate,
      endDate: maxExitDate,
      totalTrades: bTrades.length,
      openCount,
      closedCount,
      winningCount,
      losingCount,
      winRatePct,
      realizedPnlRp,
      realizedPnlPct,
      unrealizedPnlRp,
      isComplete: openCount === 0,
      trades: bTrades,
    });
  }

  return results.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

export const subscribePaperTrades = (callback: () => void) => {
  listeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === BALANCE_KEY) {
      cachedTrades = loadFromStorage();
      cachedBalance = loadBalanceFromStorage();
      callback();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
};

const getSnapshot = () => {
  ensureLoaded();
  return cachedTrades;
};

// React reads the same snapshot during server rendering and hydration.
const getServerSnapshot = () => EMPTY_SERVER_TRADES;

export function usePaperTrading(options: { autoPoll?: boolean; pollIntervalMs?: number } = {}) {
  const { autoPoll = false, pollIntervalMs = 30000 } = options;
  const trades = useSyncExternalStore(subscribePaperTrades, getSnapshot, getServerSnapshot);
  const [balance, setBalance] = useState<number>(DEFAULT_STARTING_BALANCE);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceCheckMessage, setPriceCheckMessage] = useState("");

  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    ensureLoaded();
    setBalance(cachedBalance);
  }, []);

  const openTrades = trades.filter((t) => t.status === "OPEN");
  const closedTrades = trades.filter((t) => t.status !== "OPEN");
  const summary = calculateSummary(trades, balance);

  const openTradesRef = useRef(openTrades);
  openTradesRef.current = openTrades;

  const refreshWithLivePrices = useCallback(async (force = false) => {
    const active = openTradesRef.current;
    const activeKodes = [...new Set(active.map((t) => t.kode))];
    if (activeKodes.length === 0) return;

    const now = Date.now();
    // Throttle: don't hit the API again if already fetching or if fetched less than 15s ago (unless forced)
    if (isFetchingRef.current) return;
    if (!force && now - lastFetchRef.current < 15000) return;

    try {
      isFetchingRef.current = true;
      lastFetchRef.current = now;
      setLoadingPrices(true);
      if (force) setPriceCheckMessage("");

      const query = new URLSearchParams({ kodes: activeKodes.join(","), size: "1000" });
      const res = await fetch(`/api/saham?${query}`);
      if (!res.ok) throw new Error("Harga pasar tidak tersedia.");
      const data: ListResponse = await res.json();

      const quotes = new Map<string, PaperQuote>();
      for (const item of data.items) {
        if (item.harga != null && item.quoteAt != null) {
          quotes.set(item.kode, { price: item.harga, at: item.quoteAt });
        }
      }

      const current = getPaperTrades();
      const { updatedTrades, hasChanges, checked, closed } = evaluateTradesWithLivePrices(current, quotes);
      if (hasChanges) {
        savePaperTrades(updatedTrades);
      }
      if (force) {
        setPriceCheckMessage(checked === 0
          ? "Belum ada kuotasi pasar yang bisa dipakai untuk posisi aktif."
          : `${closed} dari ${checked} posisi yang diperiksa mencapai TP atau SL.`);
      }
    } catch (err) {
      console.error("Failed to refresh live prices for paper trading", err);
      if (force) setPriceCheckMessage("Gagal memuat kuotasi pasar. Coba lagi.");
    } finally {
      isFetchingRef.current = false;
      setLoadingPrices(false);
    }
  }, []);

  // Polling live prices only when explicitly requested (e.g. in SimulasiPage), throttled to 30s+
  useEffect(() => {
    if (!autoPoll) return;

    const interval = setInterval(() => {
      if (document.hidden) return;
      if (openTradesRef.current.length > 0) {
        refreshWithLivePrices();
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [autoPoll, pollIntervalMs, refreshWithLivePrices]);

  return {
    trades,
    openTrades,
    closedTrades,
    summary,
    dailyPerformance: getDailyPerformanceMap(trades),
    batchPerformance: getBatchPerformanceList(trades),
    openTrade: openPaperTrade,
    openBatchTrades: openBatchPaperTrades,
    closeTrade: closePaperTrade,
    closeAllTrades: closeAllPaperTrades,
    deleteTrade: deletePaperTrade,
    resetTrades: resetPaperTrades,
    setStartingBalance: (val: number) => {
      setStartingBalance(val);
      setBalance(val);
    },
    refreshWithLivePrices,
    loadingPrices,
    priceCheckMessage,
  };
}

