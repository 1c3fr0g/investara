"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";

// Store modul-level supaya semua tombol bintang berbagi satu daftar
const EMPTY_LIST: string[] = [];
let kodes: string[] = EMPTY_LIST;
let loaded = false;
let loading = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(next: string[]) {
  kodes = next;
  loaded = true;
  emit();
}

async function load() {
  if (loading) return;
  loading = true;
  try {
    const r = await fetch("/api/watchlist");
    if (r.ok) set((await r.json()).kodes);
  } finally {
    loading = false;
  }
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = () => kodes;
const getServerSnapshot = () => EMPTY_LIST;

export function useWatchlist() {
  const { status } = useSession();
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    if (status === "authenticated" && !loaded) load();
    if (status === "unauthenticated" && loaded) {
      set(EMPTY_LIST);
      loaded = false;
    }
  }, [status]);

  async function toggle(kode: string) {
    const has = kodes.includes(kode);
    set(has ? kodes.filter((k) => k !== kode) : [...kodes, kode]);
    const r = await fetch(has ? `/api/watchlist?kode=${kode}` : "/api/watchlist", {
      method: has ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: has ? undefined : JSON.stringify({ kode }),
    });
    if (r.ok) set((await r.json()).kodes);
    else load();
  }

  return { list, toggle, authed: status === "authenticated", ready: status !== "loading" && (status !== "authenticated" || loaded) };
}

export function StarButton({ kode, className = "" }: { kode: string; className?: string }) {
  const { list, toggle, authed } = useWatchlist();
  const on = list.includes(kode);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!authed) return alert("Masuk dulu (menu Masuk di kanan atas) untuk memakai watchlist.");
        toggle(kode);
      }}
      title={on ? "Hapus dari watchlist" : "Tambah ke watchlist"}
      aria-label={on ? "Hapus " + kode + " dari watchlist" : "Tambah " + kode + " ke watchlist"}
      className={`text-xl leading-none transition ${on ? "text-amber-400" : "text-green-200 hover:text-amber-400"} ${className}`}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
