"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";

const EMPTY_LIST: string[] = [];
type WatchlistSnapshot = {
  owner: string | null;
  list: string[];
  status: "idle" | "loading" | "ready" | "error";
  saving: boolean;
};
const EMPTY: WatchlistSnapshot = { owner: null, list: EMPTY_LIST, status: "idle", saving: false };
let snapshot = EMPTY;
const listeners = new Set<() => void>();
let requestVersion = 0;

function set(next: WatchlistSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function selectOwner(owner: string | null) {
  if (snapshot.owner === owner) return;
  requestVersion++;
  set(owner ? { ...EMPTY, owner } : EMPTY);
}

async function load(owner: string) {
  if (snapshot.owner !== owner || snapshot.status === "loading" || snapshot.status === "ready") return;
  const version = ++requestVersion;
  set({ ...snapshot, status: "loading" });
  try {
    const response = await fetch("/api/watchlist", { cache: "no-store" });
    if (!response.ok) throw new Error("Watchlist tidak tersedia.");
    const { kodes }: { kodes: string[] } = await response.json();
    if (version === requestVersion) set({ ...snapshot, list: kodes, status: "ready" });
  } catch {
    if (version === requestVersion) set({ ...snapshot, status: "error" });
  }
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = () => snapshot;
const getServerSnapshot = () => EMPTY;

export function useWatchlist() {
  const { status, data } = useSession();
  const owner = status === "authenticated" ? data?.user?.id ?? null : null;
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const current = owner === store.owner ? store : EMPTY;
  useEffect(() => {
    selectOwner(owner);
    if (owner) void load(owner);
  }, [owner]);

  async function toggle(kode: string) {
    if (!owner || snapshot.owner !== owner || snapshot.status !== "ready" || snapshot.saving) return false;
    const version = ++requestVersion;
    const has = snapshot.list.includes(kode);
    set({ ...snapshot, saving: true });
    try {
      const response = await fetch(has ? `/api/watchlist?kode=${encodeURIComponent(kode)}` : "/api/watchlist", {
        method: has ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: has ? undefined : JSON.stringify({ kode }),
      });
      if (!response.ok) throw new Error("Gagal mengubah watchlist.");
      const { kodes }: { kodes: string[] } = await response.json();
      if (version === requestVersion) set({ ...snapshot, list: kodes });
      return true;
    } catch {
      return version !== requestVersion;
    } finally {
      if (version === requestVersion) set({ ...snapshot, saving: false });
    }
  }

  return {
    list: current.list, toggle, reload: () => owner && load(owner),
    authed: status === "authenticated", ready: current.status === "ready", saving: current.saving,
    error: current.status === "error" || (status === "authenticated" && !owner),
  };
}

export function StarButton({ kode, className = "" }: { kode: string; className?: string }) {
  const { list, toggle, authed, ready, saving, error, reload } = useWatchlist();
  const on = list.includes(kode);
  return (
    <button
      type="button"
      disabled={authed && (saving || (!ready && !error))}
      onClick={async (e) => {
        e.stopPropagation();
        if (!authed) return alert("Masuk dulu (menu Masuk di kanan atas) untuk memakai watchlist.");
        if (error) {
          await reload();
          return;
        }
        if (!await toggle(kode)) alert("Watchlist gagal diubah. Coba lagi.");
      }}
      title={error ? "Muat ulang watchlist" : on ? "Hapus dari watchlist" : "Tambah ke watchlist"}
      aria-label={error ? "Muat ulang watchlist" : on ? "Hapus " + kode + " dari watchlist" : "Tambah " + kode + " ke watchlist"}
      aria-pressed={error ? undefined : on}
      className={`text-xl leading-none transition disabled:opacity-50 ${on ? "text-amber-400" : "text-green-700 hover:text-amber-600 dark:text-green-300"} ${className}`}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
