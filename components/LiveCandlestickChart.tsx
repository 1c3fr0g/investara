"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";

export type LiveCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

interface LiveCandlestickChartProps {
  symbol: string;
  interval?: "1m" | "5m" | "15m" | "60m" | "1d";
  height?: number;
  livePrice?: number | null;
  theme?: "dark" | "light";
  isMarketOpen?: boolean;
  marketStatusLabel?: string;
  marketNextOpen?: string;
}

function formatDateTimeFull(timeMs: number, isDaily: boolean = false): string {
  const d = new Date(timeMs);
  const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const dayName = days[d.getDay()];
  const dateNum = d.getDate().toString().padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  const monthName = monthNames[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");

  if (isDaily) {
    return `${dayName}, ${dateNum} ${monthName} ${year}`;
  }
  return `${dayName}, ${dateNum} ${monthName} ${year} · ${hours}:${mins} WIB`;
}

export function LiveCandlestickChart({
  symbol,
  interval = "5m",
  height = 540,
  livePrice = null,
  theme = "light",
  isMarketOpen = true,
  marketStatusLabel = "Pasar Buka",
  marketNextOpen = "09:00 WIB",
}: LiveCandlestickChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [candles, setCandles] = useState<LiveCandle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hoveredCandle, setHoveredCandle] = useState<LiveCandle | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [activeInterval, setActiveInterval] = useState<"1m" | "5m" | "15m" | "60m" | "1d">(interval);

  // ── Interactivity State: Pan & Zoom ──
  const [zoomCandles, setZoomCandles] = useState<number>(70); // Visible candle count
  const [panOffset, setPanOffset] = useState<number>(0); // 0 = view latest; >0 = pan back into past
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Dragging refs for high-frequency events without render lag
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartPanRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);

  // Touch gesture tracking (pan & pinch-to-zoom)
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(70);

  const cleanSymbol = symbol
    .toUpperCase()
    .trim()
    .replace(/^IDX:/i, "")
    .replace(/^BINANCE:/i, "")
    .replace(/USDT$/i, "");

  // Reset pan and zoom on symbol or interval change
  useEffect(() => {
    setPanOffset(0);
    setZoomCandles(70);
  }, [cleanSymbol, activeInterval]);

  // Fetch chart data
  const fetchCandles = useCallback(async (isBackground = false) => {
    if (!cleanSymbol) return;
    if (!isBackground) setIsLoading(true);

    try {
      const res = await fetch(`/api/saham/${cleanSymbol}/chart?interval=${activeInterval}&refresh=1`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Gagal memuat candle");
      const json = await res.json();
      if (Array.isArray(json.candles) && json.candles.length > 0) {
        setCandles(json.candles);
      }
    } catch {
      // Keep existing candles
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [cleanSymbol, activeInterval]);

  useEffect(() => {
    fetchCandles(false);
  }, [fetchCandles]);

  // Live polling (every 15s if market is open, every 60s if market is closed)
  useEffect(() => {
    const pollInterval = isMarketOpen ? 15000 : 60000;
    const timer = setInterval(() => {
      if (!document.hidden) {
        fetchCandles(true);
      }
    }, pollInterval);
    return () => clearInterval(timer);
  }, [fetchCandles, isMarketOpen]);

  // Merge livePrice into latest candle if available
  const displayCandles = useMemo(() => {
    if (!candles.length || livePrice === null) return candles;
    const copy = [...candles];
    const last = { ...copy[copy.length - 1] };
    last.close = livePrice;
    if (livePrice > last.high) last.high = livePrice;
    if (livePrice < last.low) last.low = livePrice;
    copy[copy.length - 1] = last;
    return copy;
  }, [candles, livePrice]);

  // Calculate Moving Average (MA20)
  const ma20 = useMemo(() => {
    const period = 20;
    return displayCandles.map((c, i, arr) => {
      if (i < period - 1) return null;
      const slice = arr.slice(i - period + 1, i + 1);
      const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
      return sum / period;
    });
  }, [displayCandles]);

  // Derive visible candle slice based on current Zoom and Pan
  const { visibleCandles, visibleMa20, safePanOffset, maxPan } = useMemo(() => {
    const total = displayCandles.length;
    if (total === 0) {
      return {
        visibleCandles: [],
        visibleMa20: [],
        safePanOffset: 0,
        maxPan: 0,
      };
    }

    const effectiveZoom = Math.max(15, Math.min(total, zoomCandles));
    const maxPanPossible = Math.max(0, total - effectiveZoom);
    const safePan = Math.max(0, Math.min(maxPanPossible, panOffset));

    const end = total - safePan;
    const start = Math.max(0, end - effectiveZoom);

    return {
      visibleCandles: displayCandles.slice(start, end),
      visibleMa20: ma20.slice(start, end),
      safePanOffset: safePan,
      maxPan: maxPanPossible,
    };
  }, [displayCandles, ma20, zoomCandles, panOffset]);

  // Zoom controls helper
  const handleZoomChange = useCallback((deltaCandles: number) => {
    setZoomCandles((prev) => {
      const next = Math.max(15, Math.min(displayCandles.length || 300, prev + deltaCandles));
      return next;
    });
  }, [displayCandles.length]);

  // Pan controls helper
  const handlePanChange = useCallback((deltaPan: number) => {
    setPanOffset((prev) => Math.max(0, Math.min(maxPan, prev + deltaPan)));
  }, [maxPan]);

  // Reset to live / latest view
  const handleResetView = useCallback(() => {
    setPanOffset(0);
    setZoomCandles(70);
    setHoveredCandle(null);
    setMousePos(null);
  }, []);

  // ── Wheel Event Listener with passive: false for seamless Zoom In / Out ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Scroll down -> Zoom out (+ candles), Scroll up -> Zoom in (- candles)
      const zoomStep = Math.max(3, Math.round(zoomCandles * 0.1));
      if (e.deltaY > 0) {
        handleZoomChange(zoomStep);
      } else if (e.deltaY < 0) {
        handleZoomChange(-zoomStep);
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [zoomCandles, handleZoomChange]);

  // ── Render Canvas ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const canvasHeight = rect.height;

    canvas.width = width * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    const isDark = theme === "dark" || document.documentElement.classList.contains("dark");

    // Colors
    const bg = isDark ? "#12141a" : "#ffffff";
    const textMuted = isDark ? "#71717a" : "#a1a1aa";
    const gridLine = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";
    const green = "#22C55E";
    const red = "#FB6767";

    // Clear background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, canvasHeight);

    if (visibleCandles.length < 2) {
      ctx.fillStyle = textMuted;
      ctx.font = "13px Satoshi, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(isLoading ? "Memuat Candlestick Real-Time..." : "Data candle tidak tersedia", width / 2, canvasHeight / 2);
      return;
    }

    const padding = { top: 28, right: 68, bottom: 44, left: 16 };
    const chartW = width - padding.left - padding.right;
    const chartH = canvasHeight - padding.top - padding.bottom;
    const volumeH = Math.floor(chartH * 0.18);
    const priceH = chartH - volumeH - 12;

    // Compute min/max for visible viewport
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVol = 0;

    for (const c of visibleCandles) {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    }

    // Safety margins
    const priceRange = maxPrice - minPrice || 1;
    minPrice -= priceRange * 0.05;
    maxPrice += priceRange * 0.05;
    const effectivePriceRange = maxPrice - minPrice;

    const candleWidth = Math.max(2, (chartW / visibleCandles.length) * 0.7);
    const stepX = chartW / visibleCandles.length;

    const getY = (val: number) => padding.top + priceH - ((val - minPrice) / effectivePriceRange) * priceH;
    const getVolY = (vol: number) => padding.top + priceH + 12 + volumeH - (vol / (maxVol || 1)) * volumeH;

    // Draw Price Grid Lines
    const gridTiers = 5;
    ctx.strokeStyle = gridLine;
    ctx.lineWidth = 1;
    ctx.textAlign = "left";
    ctx.font = "10px Satoshi, sans-serif";

    for (let i = 0; i <= gridTiers; i++) {
      const p = minPrice + (effectivePriceRange * i) / gridTiers;
      const y = getY(p);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      ctx.fillStyle = textMuted;
      ctx.fillText(`Rp ${Math.round(p).toLocaleString("id-ID")}`, padding.left + chartW + 6, y + 3);
    }

    // Draw Volume Bars
    visibleCandles.forEach((c, idx) => {
      const x = padding.left + idx * stepX + stepX / 2;
      const isUp = c.close >= c.open;
      const vy = getVolY(c.volume);
      const vh = padding.top + priceH + 12 + volumeH - vy;

      ctx.fillStyle = isUp
        ? isDark ? "rgba(34, 197, 94, 0.25)" : "rgba(34, 197, 94, 0.35)"
        : isDark ? "rgba(251, 103, 103, 0.25)" : "rgba(251, 103, 103, 0.35)";
      ctx.fillRect(x - candleWidth / 2, vy, candleWidth, vh);
    });

    // Draw Candlesticks (Wicks + Bodies)
    visibleCandles.forEach((c, idx) => {
      const x = padding.left + idx * stepX + stepX / 2;
      const isUp = c.close >= c.open;
      const color = isUp ? green : red;

      const yHigh = getY(c.high);
      const yLow = getY(c.low);
      const yOpen = getY(c.open);
      const yClose = getY(c.close);

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = candleWidth > 4 ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));

      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // Draw MA20 Line
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let maStarted = false;
    visibleCandles.forEach((_, idx) => {
      const maVal = visibleMa20[idx];
      if (maVal !== null) {
        const x = padding.left + idx * stepX + stepX / 2;
        const y = getY(maVal);
        if (!maStarted) {
          ctx.moveTo(x, y);
          maStarted = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.stroke();

    // Draw Current Live Price Line (horizontal dashed) if viewing latest
    if (safePanOffset === 0) {
      const currentPrice = visibleCandles[visibleCandles.length - 1]?.close;
      if (typeof currentPrice === "number") {
        const curY = getY(currentPrice);
        ctx.strokeStyle = green;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, curY);
        ctx.lineTo(padding.left + chartW, curY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Price Tag Pill on right
        ctx.fillStyle = green;
        ctx.beginPath();
        ctx.roundRect(padding.left + chartW + 3, curY - 9, 62, 18, 4);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Satoshi, sans-serif";
        ctx.fillText(`${Math.round(currentPrice).toLocaleString("id-ID")}`, padding.left + chartW + 6, curY + 3.5);
      }
    }

    // Draw Time Ticks (X-axis)
    const timeStep = Math.max(1, Math.floor(visibleCandles.length / 6));
    ctx.fillStyle = textMuted;
    ctx.textAlign = "center";
    ctx.font = "10px Satoshi, sans-serif";

    visibleCandles.forEach((c, idx) => {
      if (idx % timeStep === 0 || idx === visibleCandles.length - 1) {
        const x = padding.left + idx * stepX + stepX / 2;
        const d = new Date(c.time);
        const timeStr =
          activeInterval === "1d"
            ? `${d.getDate()}/${d.getMonth() + 1}`
            : `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
        ctx.fillText(timeStr, x, canvasHeight - 12);
      }
    });

    // Crosshair & Interactive Hover (Only when not dragging)
    if (!isDraggingRef.current && mousePos && mousePos.x >= padding.left && mousePos.x <= padding.left + chartW) {
      const idx = Math.min(
        visibleCandles.length - 1,
        Math.max(0, Math.floor((mousePos.x - padding.left) / stepX))
      );
      const hovered = visibleCandles[idx];
      const candleX = padding.left + idx * stepX + stepX / 2;

      // 1. Vertical crosshair line
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(candleX, padding.top);
      ctx.lineTo(candleX, padding.top + chartH);
      ctx.stroke();

      // 2. Horizontal crosshair line
      ctx.beginPath();
      ctx.moveTo(padding.left, mousePos.y);
      ctx.lineTo(padding.left + chartW, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. X-Axis Time Badge (Crosshair Tooltip at Bottom)
      if (hovered) {
        const d = new Date(hovered.time);
        const day = d.getDate().toString().padStart(2, "0");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        const monthStr = monthNames[d.getMonth()];
        const hours = d.getHours().toString().padStart(2, "0");
        const mins = d.getMinutes().toString().padStart(2, "0");
        const timeBadgeText =
          activeInterval === "1d"
            ? `${day} ${monthStr} ${d.getFullYear()}`
            : `${day} ${monthStr} · ${hours}:${mins} WIB (Delay ~15m)`;

        ctx.font = "bold 10px Satoshi, sans-serif";
        const badgeMetrics = ctx.measureText(timeBadgeText);
        const badgeW = badgeMetrics.width + 18;
        const badgeH = 22;
        const badgeX = Math.max(padding.left, Math.min(padding.left + chartW - badgeW, candleX - badgeW / 2));
        const badgeY = padding.top + chartH + 2;

        // Pointer triangle
        ctx.fillStyle = isDark ? "#27272a" : "#18181b";
        ctx.beginPath();
        ctx.moveTo(candleX - 4, badgeY);
        ctx.lineTo(candleX, badgeY - 4);
        ctx.lineTo(candleX + 4, badgeY);
        ctx.closePath();
        ctx.fill();

        // Rounded badge
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
        ctx.fill();

        ctx.strokeStyle = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(timeBadgeText, badgeX + badgeW / 2, badgeY + 15);
      }

      // 4. Y-Axis Price Badge (Crosshair Tooltip on Right)
      if (mousePos.y >= padding.top && mousePos.y <= padding.top + priceH) {
        const hoverPrice = minPrice + ((padding.top + priceH - mousePos.y) / priceH) * effectivePriceRange;
        const priceText = `Rp ${Math.round(hoverPrice).toLocaleString("id-ID")}`;
        const pBadgeW = 68;
        const pBadgeH = 20;
        const pBadgeX = padding.left + chartW + 3;
        const pBadgeY = mousePos.y - pBadgeH / 2;

        ctx.fillStyle = isDark ? "#3f3f46" : "#27272a";

        // Pointer triangle to left
        ctx.beginPath();
        ctx.moveTo(pBadgeX, mousePos.y);
        ctx.lineTo(pBadgeX + 4, mousePos.y - 4);
        ctx.lineTo(pBadgeX + 4, mousePos.y + 4);
        ctx.closePath();
        ctx.fill();

        // Rounded badge
        ctx.beginPath();
        ctx.roundRect(pBadgeX + 3, pBadgeY, pBadgeW - 3, pBadgeH, 4);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Satoshi, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(priceText, pBadgeX + 8, pBadgeY + 14);
      }
    }
  }, [visibleCandles, visibleMa20, theme, mousePos, activeInterval, isLoading, safePanOffset]);

  // ── Drag & Pan Handlers (Mouse) ──
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Left click only
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartPanRef.current = safePanOffset;
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !visibleCandles.length) return;
    const rect = canvas.getBoundingClientRect();
    const padding = { top: 28, right: 68, bottom: 44, left: 16 };
    const chartW = rect.width - padding.left - padding.right;
    const stepX = chartW / Math.max(1, visibleCandles.length);

    // If currently dragging to pan
    if (isDraggingRef.current) {
      const deltaX = e.clientX - dragStartXRef.current;
      if (Math.abs(deltaX) > 2) {
        hasMovedRef.current = true;
        // Dragging right (deltaX > 0) scrolls back in time (increases panOffset)
        const candleDelta = Math.round(deltaX / Math.max(2, stepX));
        const newPan = Math.max(0, Math.min(maxPan, dragStartPanRef.current + candleDelta));
        setPanOffset(newPan);
        // Suppress crosshair during pan
        setHoveredCandle(null);
        setMousePos(null);
      }
      return;
    }

    // Normal Hover Crosshair
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= padding.left && x <= padding.left + chartW) {
      const idx = Math.min(
        visibleCandles.length - 1,
        Math.max(0, Math.floor((x - padding.left) / stepX))
      );
      setHoveredCandle(visibleCandles[idx]);
      setMousePos({ x, y });
    } else {
      setHoveredCandle(null);
      setMousePos(null);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    if (!isDraggingRef.current) {
      setHoveredCandle(null);
      setMousePos(null);
    }
  };

  // Double click resets view to latest & default zoom
  const handleDoubleClick = () => {
    handleResetView();
  };

  // Window-level mouseup listener to release drag safely anywhere
  useEffect(() => {
    const onWindowMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, []);

  // ── Touch Gesture Handlers (Mobile / Tablet Pan & Pinch-to-Zoom) ──
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      // 1 Finger: Pan Drag
      isDraggingRef.current = true;
      dragStartXRef.current = e.touches[0].clientX;
      dragStartPanRef.current = safePanOffset;
      setIsDragging(true);
      pinchStartDistRef.current = null;
    } else if (e.touches.length === 2) {
      // 2 Fingers: Pinch Zoom
      isDraggingRef.current = false;
      setIsDragging(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchStartDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchStartZoomRef.current = zoomCandles;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !visibleCandles.length) return;
    const rect = canvas.getBoundingClientRect();
    const padding = { top: 28, right: 68, bottom: 44, left: 16 };
    const chartW = rect.width - padding.left - padding.right;
    const stepX = chartW / Math.max(1, visibleCandles.length);

    if (e.touches.length === 1 && isDraggingRef.current) {
      const deltaX = e.touches[0].clientX - dragStartXRef.current;
      const candleDelta = Math.round(deltaX / Math.max(2, stepX));
      const newPan = Math.max(0, Math.min(maxPan, dragStartPanRef.current + candleDelta));
      setPanOffset(newPan);
      setHoveredCandle(null);
      setMousePos(null);
    } else if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scale = currentDist / pinchStartDistRef.current;
      // Pinch out (scale > 1) -> zoom in (fewer candles); Pinch in (scale < 1) -> zoom out (more candles)
      const targetZoom = Math.round(pinchStartZoomRef.current / scale);
      setZoomCandles(Math.max(15, Math.min(displayCandles.length || 300, targetZoom)));
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    pinchStartDistRef.current = null;
  };

  const activeCandle = hoveredCandle || visibleCandles[visibleCandles.length - 1];

  return (
    <div ref={containerRef} className="relative w-full select-none">
      {/* ── Sub-header: Real-Time HUD and Quick Timeframes ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-zinc-200/60 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.01]">
        {/* Left: Interactive OHLCV HUD with Date & Time */}
        {activeCandle ? (
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
            {/* Full Date & Hour */}
            <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 bg-zinc-200/60 dark:bg-white/10 px-2 py-0.5 rounded-full">
              <span>⏱</span>
              <span>{formatDateTimeFull(activeCandle.time, activeInterval === "1d")}</span>
              {hoveredCandle && (
                <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-1 rounded">
                  INSPEKSI
                </span>
              )}
            </span>

            {/* Market Status & Delay Notice Pill */}
            {!isMarketOpen ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-zinc-200/80 dark:bg-white/10 border border-zinc-300 dark:border-white/15 px-2.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300"
                title="Bursa Efek Indonesia sedang tutup. Data menampilkan harga penutupan resmi (Closing Price)."
              >
                <span>🌙</span>
                <span>Pasar Tutup (Closing Price)</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400"
                title="Data candlestick mengalami penundaan (delay) 10-15 menit sesuai aturan feed bursa saham"
              >
                <span>⏱</span>
                <span>Data Delay ~10-15 Mnt (Aturan Bursa)</span>
              </span>
            )}

            <span>
              O: <strong className="text-zinc-800 dark:text-zinc-100">Rp {activeCandle.open.toLocaleString("id-ID")}</strong>
            </span>
            <span>
              H: <strong className="text-emerald-600 dark:text-emerald-400">Rp {activeCandle.high.toLocaleString("id-ID")}</strong>
            </span>
            <span>
              L: <strong className="text-[#FB6767]">Rp {activeCandle.low.toLocaleString("id-ID")}</strong>
            </span>
            <span>
              C:{" "}
              <strong
                className={
                  activeCandle.close >= activeCandle.open
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-[#FB6767]"
                }
              >
                Rp {activeCandle.close.toLocaleString("id-ID")}
              </strong>
            </span>
            <span className="text-zinc-400">
              Vol: <strong className="text-zinc-600 dark:text-zinc-300">{(activeCandle.volume / 1000).toFixed(1)}k</strong>
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-zinc-400">Memuat data candle...</div>
        )}

        {/* Right: Timeframe Pills */}
        <div className="flex items-center gap-1 rounded-full ios-glass-subtle p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveInterval("1m")}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
              activeInterval === "1m"
                ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            1M
          </button>
          <button
            type="button"
            onClick={() => setActiveInterval("5m")}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
              activeInterval === "5m"
                ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            5M
          </button>
          <button
            type="button"
            onClick={() => setActiveInterval("15m")}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
              activeInterval === "15m"
                ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            15M
          </button>
          <button
            type="button"
            onClick={() => setActiveInterval("60m")}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
              activeInterval === "60m"
                ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            1H
          </button>
          <button
            type="button"
            onClick={() => setActiveInterval("1d")}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
              activeInterval === "1d"
                ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            1D
          </button>
        </div>
      </div>

      {/* ── Canvas Chart Container ── */}
      <div className="relative w-full overflow-hidden" style={{ height: `${height}px` }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`w-full h-full block touch-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        />

        {/* ── Floating Navigation & Zoom Toolbar (VisionOS Glassmorphic Pill) ── */}
        <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5 rounded-full ios-glass-subtle px-2.5 py-1.5 border border-zinc-200/80 dark:border-white/10 shadow-lg text-xs backdrop-blur-md">
          {/* Zoom Out Button */}
          <button
            type="button"
            onClick={() => handleZoomChange(12)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-extrabold shadow-2xs transition"
            title="Perkecil / Tampilkan Lebih Banyak Candle (Zoom Out - Scroll Bawah)"
          >
            −
          </button>

          {/* Candle Count Indicator */}
          <span className="px-1.5 text-[10.5px] font-bold text-zinc-600 dark:text-zinc-300 tabular-nums">
            🔍 {visibleCandles.length} bar
          </span>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={() => handleZoomChange(-12)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-extrabold shadow-2xs transition"
            title="Perbesar / Detail Lilin Candle (Zoom In - Scroll Atas)"
          >
            +
          </button>

          <span className="mx-0.5 h-3.5 w-px bg-zinc-300 dark:bg-white/15" />

          {/* Pan Left (Older) */}
          <button
            type="button"
            disabled={safePanOffset >= maxPan}
            onClick={() => handlePanChange(15)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 shadow-2xs transition text-[11px]"
            title="Geser ke Data Lebih Lama (Pan Kiri / Masa Lalu)"
          >
            ◀
          </button>

          {/* Pan Right (Newer) */}
          <button
            type="button"
            disabled={safePanOffset <= 0}
            onClick={() => handlePanChange(-15)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 shadow-2xs transition text-[11px]"
            title="Geser ke Data Terkini (Pan Kanan)"
          >
            ▶
          </button>

          {/* Reset View Button */}
          <button
            type="button"
            onClick={handleResetView}
            className="rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-2 py-0.5 text-[10px] font-bold shadow-2xs transition hover:opacity-90"
            title="Reset ke Tampilan Default (70 Candle Terkini · Klik Ganda Canvas)"
          >
            ↺ Reset
          </button>
        </div>

        {/* ── Active Historical Pan Notification: "Kembali ke Terkini" ── */}
        {safePanOffset > 0 && (
          <div className="absolute top-14 right-4 z-20 animate-in fade-in slide-in-from-top-1 duration-200">
            <button
              type="button"
              onClick={handleResetView}
              className="flex items-center gap-1.5 rounded-full bg-amber-500 text-white px-3 py-1 text-[11px] font-black shadow-lg hover:bg-amber-600 transition"
              title="Klik untuk langsung melompat kembali ke candlestick live terkini"
            >
              <span>▶</span>
              <span>Kembali ke Terkini (-{safePanOffset} bar)</span>
            </button>
          </div>
        )}

        {/* Legend Overlay at Top Left */}
        <div className="absolute top-3 left-4 flex flex-wrap items-center gap-2.5 text-[11px] font-bold pointer-events-none">
          <span className="flex items-center gap-1.5 text-zinc-900 dark:text-white">
            <span
              className={`h-2 w-2 rounded-full inline-block ${
                isMarketOpen ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
              }`}
            ></span>
            <span>{cleanSymbol}</span>
          </span>
          <span className="text-[#8b5cf6] flex items-center gap-1">
            <span className="h-0.5 w-3 bg-[#8b5cf6] inline-block"></span>
            <span>MA20</span>
          </span>
          {!isMarketOpen ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800/80 text-zinc-200 border border-zinc-700 px-2 py-0.5 text-[9.5px] font-bold backdrop-blur-xs">
              <span>🌙</span>
              <span>Pasar Tutup (Harga Penutupan)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[9.5px] font-extrabold text-amber-700 dark:text-amber-300 backdrop-blur-xs">
              <span>⏱</span>
              <span>Delay ~10-15 Mnt (Aturan Bursa)</span>
            </span>
          )}
        </div>

        {/* Floating Hover Tooltip Card Following Mouse (Shown only when not dragging) */}
        {!isDragging && hoveredCandle && mousePos && (() => {
          const containerW = containerRef.current?.clientWidth || 700;
          const cardW = 236;
          const isRightHalf = mousePos.x > containerW / 2;
          const leftPos = isRightHalf
            ? Math.max(12, mousePos.x - cardW - 16)
            : Math.min(containerW - cardW - 16, mousePos.x + 16);
          const topPos = Math.max(12, Math.min(mousePos.y - 40, height - 190));

          const candleChg = hoveredCandle.close - hoveredCandle.open;
          const candlePct = hoveredCandle.open > 0 ? (candleChg / hoveredCandle.open) * 100 : 0;
          const isUp = hoveredCandle.close >= hoveredCandle.open;
          const turnover = hoveredCandle.volume * hoveredCandle.close;

          return (
            <div
              className="pointer-events-none absolute z-30 rounded-2xl border border-zinc-200/90 bg-white/95 p-3.5 shadow-2xl backdrop-blur-md dark:border-white/15 dark:bg-[#191919]/95 text-xs transition-[left,top] duration-75 min-w-[230px]"
              style={{
                left: `${leftPos}px`,
                top: `${topPos}px`,
              }}
            >
              {/* Header: Exact Date and Time */}
              <div className="flex items-center justify-between gap-2 border-b border-zinc-200/60 pb-1.5 mb-1.5 dark:border-white/10">
                <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full inline-block ${
                      isMarketOpen ? "bg-emerald-500" : "bg-zinc-400"
                    }`}
                  ></span>
                  <span>{formatDateTimeFull(hoveredCandle.time, activeInterval === "1d")}</span>
                </span>
                <span className="text-[9px] font-black tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  {activeInterval.toUpperCase()}
                </span>
              </div>

              {/* Delay & Market Status Clarification Pill */}
              <div
                className={`mb-2 flex items-center gap-1 rounded-md px-2 py-0.5 text-[9.5px] font-bold border ${
                  !isMarketOpen
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                }`}
              >
                <span>{!isMarketOpen ? "🌙" : "⏱"}</span>
                <span>
                  {!isMarketOpen
                    ? "Pasar Tutup · Menampilkan data penutupan hari ini"
                    : "Waktu candle tertunda ~10–15 mnt (Regulasi BEI)"}
                </span>
              </div>

              {/* OHLC Metrics */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-zinc-400">Buka:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
                    Rp {hoveredCandle.open.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-zinc-400">Tertinggi:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    Rp {hoveredCandle.high.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-zinc-400">Terendah:</span>
                  <span className="font-bold text-[#FB6767] tabular-nums">
                    Rp {hoveredCandle.low.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-zinc-400">Tutup:</span>
                  <span
                    className={`font-black tabular-nums ${
                      isUp ? "text-emerald-600 dark:text-emerald-400" : "text-[#FB6767]"
                    }`}
                  >
                    Rp {hoveredCandle.close.toLocaleString("id-ID")}
                  </span>
                </div>

                {/* Perubahan Candle */}
                <div className="flex items-center justify-between gap-1 col-span-2 pt-1 border-t border-zinc-100 dark:border-white/5">
                  <span className="text-zinc-400">Perubahan:</span>
                  <span
                    className={`font-bold tabular-nums ${
                      isUp ? "text-emerald-600 dark:text-emerald-400" : "text-[#FB6767]"
                    }`}
                  >
                    {isUp ? "▲ +" : "▼ "}{candleChg.toLocaleString("id-ID")} ({isUp ? "+" : ""}{candlePct.toFixed(2)}%)
                  </span>
                </div>

                {/* Volume & Estimasi Nilai Transaksi */}
                <div className="flex items-center justify-between gap-1 col-span-2">
                  <span className="text-zinc-400">Volume:</span>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                    {hoveredCandle.volume.toLocaleString("id-ID")} lembar
                  </span>
                </div>
                {turnover > 0 && (
                  <div className="flex items-center justify-between gap-1 col-span-2">
                    <span className="text-zinc-400">Turnover:</span>
                    <span className="font-semibold text-zinc-600 dark:text-zinc-300 tabular-nums">
                      Rp {turnover >= 1e9 ? `${(turnover / 1e9).toFixed(2)} Miliar` : turnover >= 1e6 ? `${(turnover / 1e6).toFixed(1)} Juta` : turnover.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Bottom Interactive Guide & Disclaimer */}
        <div className="pointer-events-none absolute bottom-1.5 left-4 right-4 flex flex-wrap items-center justify-between gap-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5 bg-white/85 dark:bg-black/60 px-2.5 py-0.5 rounded-full border border-zinc-200/50 dark:border-white/10 backdrop-blur-xs">
            <span>💡</span>
            <span>Drag untuk geser (pan) · Scroll untuk zoom · Double click untuk reset</span>
          </div>

          <div className="bg-white/85 dark:bg-black/60 px-2.5 py-0.5 rounded-full border border-zinc-200/50 dark:border-white/10 backdrop-blur-xs">
            {!isMarketOpen
              ? "🌙 Pasar Tutup: Data penutupan resmi BEI (Closing Price)"
              : "⏱ Waktu candle tertunda ~10–15 menit (Aturan IDX)"}
          </div>
        </div>
      </div>
    </div>
  );
}
