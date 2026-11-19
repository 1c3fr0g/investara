"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface PriceFlashProps {
  value: number | null | undefined;
  children: ReactNode;
  className?: string;
  type?: "hero" | "cell" | "inline";
}

export function PriceFlash({
  value,
  children,
  className = "",
  type = "cell",
}: PriceFlashProps) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevRef = useRef<number | null | undefined>(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (
      prevRef.current !== undefined &&
      prevRef.current !== null &&
      value !== undefined &&
      value !== null
    ) {
      if (value > prevRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        setFlash("up");
        timerRef.current = setTimeout(() => setFlash(null), 3200);
      } else if (value < prevRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        setFlash("down");
        timerRef.current = setTimeout(() => setFlash(null), 3200);
      }
    }
    prevRef.current = value;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  const flashClass = flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : "";
  const baseClass =
    type === "hero"
      ? "rounded-2xl px-2.5 py-1 inline-flex items-center"
      : type === "inline"
      ? "rounded px-1 inline-flex items-center"
      : "rounded-lg px-2 py-0.5 inline-block";

  return (
    <span className={`${baseClass} ${flashClass} transition-all duration-300 ${className}`}>
      {children}
    </span>
  );
}

export function LiveBadge({ label = "Live Ticker" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-50/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 shadow-2xs backdrop-blur-md dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
      </span>
      <span>{label}</span>
    </span>
  );
}

