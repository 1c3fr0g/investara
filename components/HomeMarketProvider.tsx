"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { track } from "@vercel/analytics";
import type { NewsScan } from "@/lib/sentimentScanner";
import type { PasarResponse } from "@/lib/types";

const SCAN_INTERVAL = 5 * 60 * 1000;

type SectorReport = Pick<PasarResponse, "sektor" | "updatedAt">;
type SentimentFilter = { kodes: string[]; label: string };

type HomeMarket = {
  sectorReport: SectorReport | null;
  sectorFailed: boolean;
  refreshSectors: () => Promise<void>;
  sentimentFilter: SentimentFilter | null;
  setSentimentFilter: (filter: SentimentFilter | null) => void;
  scan: NewsScan | null;
  isScanning: boolean;
  hasError: boolean;
  refresh: () => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  radarOpen: boolean;
  setRadarOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  radarHeading: RefObject<HTMLHeadingElement | null>;
  openRadar: () => void;
};

const HomeMarketContext = createContext<HomeMarket | null>(null);

export function HomeMarketProvider({ children }: { children: ReactNode }) {
  const [sectorReport, setSectorReport] = useState<SectorReport | null>(null);
  const [sectorFailed, setSectorFailed] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter | null>(null);
  const [scan, setScan] = useState<NewsScan | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [radarOpen, setRadarOpen] = useState(false);
  const radarHeading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<AbortController | null>(null);
  const pendingSectors = useRef<AbortController | null>(null);

  const refreshSectors = useCallback(async () => {
    if (pendingSectors.current) return;
    const controller = new AbortController();
    pendingSectors.current = controller;
    try {
      const response = await fetch("/api/pasar", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Data sektor tidak tersedia.");
      const { sektor, updatedAt }: PasarResponse = await response.json();
      if (!Array.isArray(sektor) || !Number.isFinite(updatedAt)) throw new Error("Respons sektor tidak valid.");
      if (controller.signal.aborted) return;
      setSectorReport({ sektor, updatedAt });
      setSectorFailed(false);
    } catch {
      if (!controller.signal.aborted) setSectorFailed(true);
    } finally {
      if (pendingSectors.current === controller) pendingSectors.current = null;
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshSectors(), 0);
    const refreshWhenVisible = () => {
      if (!document.hidden) void refreshSectors();
    };
    const timer = window.setInterval(refreshWhenVisible, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      pendingSectors.current?.abort();
      pendingSectors.current = null;
    };
  }, [refreshSectors]);

  const load = useCallback(async (force = false) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setIsScanning(true);

    try {
      const response = await fetch(force ? "/api/sentimen-pasar?refresh=1" : "/api/sentimen-pasar", {
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("Pindai berita gagal.");
      const next: NewsScan = await response.json();
      if (!next.status || !Array.isArray(next.catalysts) || !Array.isArray(next.picks)) throw new Error("Respons pindai berita tidak valid.");
      if (controller.signal.aborted) return;
      setScan(next);
      setHasError(false);
    } catch {
      if (!controller.signal.aborted) {
        setScan(null);
        setHasError(true);
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setIsScanning(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!radarOpen) return;
    const initial = window.setTimeout(() => void load(), 0);
    const refreshWhenVisible = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(refreshWhenVisible, SCAN_INTERVAL);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      pending.current?.abort();
      pending.current = null;
    };
  }, [load, radarOpen]);

  function openRadar() {
    if (!radarOpen) track("news_radar_opened");
    setRadarOpen(true);
    radarHeading.current?.focus({ preventScroll: true });
    radarHeading.current?.scrollIntoView({ block: "start" });
  }

  return (
    <HomeMarketContext.Provider value={{
      sectorReport, sectorFailed, refreshSectors, sentimentFilter, setSentimentFilter,
      scan, isScanning, hasError, refresh: () => void load(true), selectedId, setSelectedId,
      radarOpen, setRadarOpen, radarHeading, openRadar,
    }}>
      {children}
    </HomeMarketContext.Provider>
  );
}

export function useHomeMarket() {
  const market = useContext(HomeMarketContext);
  if (!market) throw new Error("HomeMarketProvider is required.");
  return market;
}
