"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { PAPER_SYNC_LIMIT, type OfflineFill, type OfflineTrade, type OfflineTradeEnd } from "@/lib/paperOffline";
import { applyOfflinePaperFills, getPaperTrades, subscribePaperTrades } from "@/lib/paperTrading";

type State = "loading" | "guest" | "off" | "syncing" | "ready" | "error";
const OfflinePaperContext = createContext({ state: "loading" as State, sync: () => {} });

export function useOfflinePaperTrading() {
  return useContext(OfflinePaperContext);
}

export function OfflinePaperTrading({ children }: { children: ReactNode }) {
  const { data, status } = useSession();
  const userId = data?.user?.id;
  const command = useRef<() => void>(() => {});
  const [syncState, setSyncState] = useState<{ key: string; state: State }>();
  const key = userId ? `investara_paper_offline:${userId}` : "";

  useEffect(() => {
    if (!key) return;
    let active = true;
    let tracked: Set<string> | null = null;
    let running = false;
    let pending = false;
    let lastBody = "";

    const publish = (state: State) => setSyncState({ key, state });
    const readTracked = () => {
      const value = localStorage.getItem(key);
      const ids: unknown = value === null ? null : JSON.parse(value);
      return Array.isArray(ids) ? new Set(ids.filter((id): id is string => typeof id === "string")) : null;
    };
    try {
      tracked = readTracked();
    } catch {
      // Let the user retry activation when browser storage becomes available.
    }

    async function sync(force = false) {
      if (!active || !tracked) return;
      if (running) {
        pending = true;
        return;
      }

      const stored = getPaperTrades();
      const trades: OfflineTrade[] = stored.flatMap((t) => t.status === "OPEN" ? [{
        id: t.id, kode: t.kode, entryAt: Date.parse(t.entryDate),
        targetTp1: t.targetTp1, targetTp2: t.targetTp2, stopLoss: t.stopLoss,
      }] : []);
      const activeIds = new Set(trades.map(({ id }) => id));
      const storedById = new Map(stored.map((t) => [t.id, t]));
      const ended: OfflineTradeEnd[] = [...tracked].filter((id) => !activeIds.has(id)).map((id) => {
        const exitAt = Date.parse(storedById.get(id)?.exitDate ?? "");
        return { id, at: Number.isFinite(exitAt) ? exitAt : null };
      });
      const body = JSON.stringify({ trades, ended });
      if (!force && lastBody === body) return;

      running = true;
      publish("syncing");
      try {
        for (const id of activeIds) tracked.add(id);
        localStorage.setItem(key, JSON.stringify([...tracked]));
        const total = Math.max(trades.length, ended.length);
        for (let i = 0; i < total; i += PAPER_SYNC_LIMIT) {
          const response = await fetch("/api/simulasi/offline", {
            method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
            signal: AbortSignal.timeout(20_000),
            body: JSON.stringify({ trades: trades.slice(i, i + PAPER_SYNC_LIMIT), ended: ended.slice(i, i + PAPER_SYNC_LIMIT) }),
          });
          if (!response.ok) throw new Error("Sync failed");
          const result: { fills: OfflineFill[]; settledIds: string[] } = await response.json();
          if (!active) return;

          applyOfflinePaperFills(result.fills);
          tracked = readTracked() ?? tracked;
          for (const id of result.settledIds) tracked.delete(id);
          localStorage.setItem(key, JSON.stringify([...tracked]));
        }
        lastBody = body;
        publish("ready");
      } catch {
        if (active) publish("error");
      } finally {
        running = false;
        if (pending) {
          pending = false;
          void sync();
        }
      }
    }

    command.current = () => {
      if (!tracked) tracked = new Set();
      void sync(true);
    };
    const onChange = () => { void sync(); };
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync(true);
    };
    const unsubscribe = subscribePaperTrades(onChange);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) tracked = readTracked();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("online", onVisible);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 180_000);
    if (tracked) void sync(true);
    else publish("off");

    return () => {
      active = false;
      command.current = () => {};
      unsubscribe();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [key]);

  const state = key && syncState?.key === key ? syncState.state : status === "unauthenticated" ? "guest" : "loading";
  return <OfflinePaperContext.Provider value={{ state, sync: () => command.current() }}>{children}</OfflinePaperContext.Provider>;
}
