"use client";

import { getProviders, signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

const LABEL: Record<string, string> = { github: "GitHub", google: "Google" };

export function useProviders() {
  const [list, setList] = useState<string[] | null>(null);
  useEffect(() => {
    getProviders()
      .then((p) => setList(p ? Object.keys(p) : []))
      .catch(() => setList([]));
  }, []);
  return list;
}

export function LoginButtons({ callbackUrl = "/portofolio" }: { callbackUrl?: string }) {
  const providers = useProviders();
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "daftar") {
        const r = await fetch("/api/daftar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
        if (!r.ok) return setErr((await r.json()).error ?? "Gagal mendaftar");
      }
      const res = await signIn("credentials", { username, password, redirect: false });
      if (res?.error) return setErr("Username atau password salah.");
      window.location.href = callbackUrl;
    } finally {
      setBusy(false);
    }
  }

  const oauth = (providers ?? []).filter((p) => p !== "credentials");
  const input = "w-full rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3.5 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#9A83FF]/40 text-[#191919] dark:text-white transition";
  return (
    <div className="ios-glass-card rounded-[28px] p-6 space-y-4 border border-zinc-200/80 dark:border-white/10 shadow-xl max-w-sm">
      <form onSubmit={submit} className="space-y-3">
        <input className={input} placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className={input} type="password" placeholder="Password" autoComplete={mode === "daftar" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="text-xs font-bold text-rose-500">{err}</p>}
        <button disabled={busy} className="w-full rounded-full bg-[#191919] text-white hover:bg-black dark:bg-white dark:text-[#191919] px-4 py-2.5 text-xs font-black shadow-md hover:scale-[1.01] active:scale-95 transition disabled:opacity-60">
          {mode === "masuk" ? "Masuk ke Akun" : "Daftar & Masuk"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "masuk" ? "daftar" : "masuk"); setErr(""); }} className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:underline block text-center w-full">
          {mode === "masuk" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
        </button>
      </form>
      {oauth.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-zinc-200/70 dark:border-white/10 pt-4">
          {oauth.map((id) => (
            <button key={id} onClick={() => signIn(id, { callbackUrl })} className="ios-glass-subtle flex-1 rounded-full border border-zinc-200/80 dark:border-white/10 px-4 py-2 text-xs font-bold text-[#191919] dark:text-white hover:bg-white dark:hover:bg-white/10 shadow-xs transition">
              Masuk dengan {LABEL[id] ?? id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuthMenu() {
  const { data, status } = useSession();
  if (status === "loading") return <span className="px-3 text-xs text-zinc-400">...</span>;
  if (!data?.user)
    return (
      <Link
        href="/portofolio"
        className="rounded-full bg-[#191919] px-3.5 py-1.5 text-xs font-black text-white hover:bg-black dark:bg-white dark:text-[#191919] dark:hover:bg-zinc-200 shadow-xs hover:scale-[1.02] active:scale-95 transition shrink-0 whitespace-nowrap"
      >
        Masuk
      </Link>
    );
  return (
    <div className="ios-glass-subtle flex items-center gap-2 rounded-full border border-zinc-200/80 dark:border-white/10 py-1 pl-1 pr-2 shadow-xs shrink-0 max-w-[210px] overflow-hidden">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#191919] text-[10px] font-black uppercase text-white dark:bg-white dark:text-[#191919] shadow-2xs shrink-0">
        {(data.user.name ?? data.user.email ?? "?").charAt(0)}
      </span>
      <span className="hidden sm:block text-xs font-bold text-[#191919] dark:text-white max-w-[95px] truncate shrink-0">
        {data.user.name ?? data.user.email}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded-full bg-zinc-200/70 hover:bg-zinc-300 text-zinc-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-zinc-200 px-2 py-0.5 text-[10px] font-bold transition shrink-0"
      >
        Keluar
      </button>
    </div>
  );
}
