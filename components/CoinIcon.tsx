"use client";

import { useState } from "react";

interface CoinIconProps {
  symbol: string;
  name: string;
  className?: string;
  size?: number;
}

export function CoinIcon({
  symbol,
  name,
  className = "h-8 w-8",
  size = 32,
}: CoinIconProps) {
  const [srcIndex, setSrcIndex] = useState(0);
  const [failedAll, setFailedAll] = useState(false);
  const s = symbol.toLowerCase();

  // Multi-tier reliable CDNs for high-resolution crypto icons
  const sources = [
    `https://assets.coincap.io/assets/icons/${s}@2x.png`,
    `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63539be16e33816a085462de70f4a64990f740/128/color/${s}.png`,
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${s}.png`,
  ];

  if (failedAll) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 font-bold text-white shadow-xs ${className}`}
        style={{ fontSize: `${Math.max(10, size * 0.35)}px` }}
        title={`${name} (${symbol})`}
      >
        {symbol.slice(0, 3)}
      </div>
    );
  }

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800 ${className}`}
      title={`${name} (${symbol})`}
    >
      <img
        src={sources[srcIndex]}
        alt={name}
        width={size}
        height={size}
        className="h-full w-full object-contain"
        onError={() => {
          if (srcIndex < sources.length - 1) {
            setSrcIndex((prev) => prev + 1);
          } else {
            setFailedAll(true);
          }
        }}
      />
    </div>
  );
}

