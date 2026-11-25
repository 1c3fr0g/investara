"use client";

import { useEffect, useRef, useState } from "react";

export function useComparisonData<T>(symbols: string[], resource: string) {
  const [cache, setCache] = useState<Record<string, T | null | undefined>>({});
  const pending = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const requests = pending.current;
    return () => {
      for (const controller of requests.values()) controller.abort();
      requests.clear();
    };
  }, []);

  useEffect(() => {
    const requests = pending.current;
    for (const symbol of symbols) {
      if (cache[symbol] !== undefined || requests.has(symbol)) continue;
      const controller = new AbortController();
      requests.set(symbol, controller);
      fetch(resource + "/" + encodeURIComponent(symbol), { signal: controller.signal })
        .then(async (response): Promise<T | null> => response.ok ? response.json() : null)
        .catch(() => null)
        .then((data) => {
          if (controller.signal.aborted) return;
          requests.delete(symbol);
          setCache((previous) => ({ ...previous, [symbol]: data }));
        });
    }
  }, [symbols, resource, cache]);

  function retry(symbolsToRetry: string[]) {
    setCache((previous) => {
      const next = { ...previous };
      for (const symbol of symbolsToRetry) if (next[symbol] === null) delete next[symbol];
      return next;
    });
  }

  return { cache, setCache, retry };
}
