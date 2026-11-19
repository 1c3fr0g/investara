"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "./ui";
import { LoginButtons } from "./AuthButtons";
import { AlertInbox } from "./AlertInbox";
import { num, rp } from "@/lib/format";

type AlertItem = {
  id: string;
  kode: string;
  nama: string;
  kondisi: "DIATAS" | "DIBAWAH";
  target_harga: number;
  catatan: string | null;
  aktif: number;
  triggered: number;
  harga_sekarang: number | null;
  perubahan_pct: number | null;
  selisih_pct: number | null;
  created_at: number;
};

export function AlertManager({ initialCode }: { initialCode: string }) {
  const { status, data } = useSession();

  if (status === "loading") {
    return (
      <main className="screen-shell screen-section text-sm text-zinc-600 dark:text-zinc-400">
        Memuat notifikasi alert...
      </main>
    );
  }

  if (!data?.user) {
    return (
      <main className="screen-shell space-y-6 screen-section">
        <div className="crystal-intro">
          <h1 className="crystal-title">
            Alert & Notifikasi Harga
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Dapatkan peringatan saat harga saham mencapai target atau memenuhi kriteria screener.
          </p>
        </div>
        <Card>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
            Masuk untuk Mengaktifkan Alert Harga
          </h2>
          <p className="mb-4 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Alert harga dan sinyal screener Anda disimpan di database dan tersinkronisasi di semua perangkat Anda.
          </p>
          <LoginButtons callbackUrl={initialCode ? "/alerts?kode=" + initialCode + "#alert-harga-baru" : "/alerts"} />
        </Card>
      </main>
    );
  }

  return <AlertView key={initialCode} initialCode={initialCode} />;
}

function AlertView({ initialCode }: { initialCode: string }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [kode, setKode] = useState(initialCode);
  const [kondisi, setKondisi] = useState<"DIATAS" | "DIBAWAH">("DIATAS");
  const [targetHarga, setTargetHarga] = useState("");
  const [catatan, setCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadAlerts = () => {
    fetch("/api/alerts")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { items?: AlertItem[] } | null) => {
        if (j?.items) setAlerts(j.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const k = kode.trim().toUpperCase();
    const target = Number(targetHarga.replace(/\D/g, ""));
    if (!/^[A-Z0-9]{4}$/.test(k)) return setError("Kode saham harus 4 huruf/angka (contoh: BBCA)");
    if (!(target > 0)) return setError("Target harga harus lebih dari 0");

    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode: k, kondisi, target_harga: target, catatan }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Gagal menyimpan alert");
      }
      setKode("");
      setTargetHarga("");
      setCatatan("");
      loadAlerts();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Gagal");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleAktif(id: string, current: number) {
    const next = current === 1 ? false : true;
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, aktif: next }),
    });
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, aktif: next ? 1 : 0 } : a)));
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  const triggeredCount = alerts.filter((a) => a.aktif === 1 && a.triggered === 1).length;

  return (
    <main className="screen-shell space-y-6 screen-section">
      <div className="crystal-intro">
        <h1 className="crystal-title">
          Alert Harga & Kriteria Screener
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Notifikasi otomatis ketika harga saham mencapai level target atau batas akumulasi Anda.
        </p>
      </div>

      {/* Summary KPI Badges */}
      <AlertInbox />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Alert Aktif</span>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {alerts.filter((a) => a.aktif === 1).length}
            </div>
          </div>
          <span className="text-2xl">🔔</span>
        </Card>

        <Card className="flex items-center justify-between border-amber-200 dark:border-amber-800/60">
          <div>
            <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">Target Tercapai!</span>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-300">
              {triggeredCount}
            </div>
          </div>
          <span className="text-2xl">🎯</span>
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Saham Dipantau</span>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {new Set(alerts.map((a) => a.kode)).size}
            </div>
          </div>
          <span className="text-2xl">📈</span>
        </Card>
      </div>

      {/* Triggered Alert Announcement Banner */}
      {triggeredCount > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <h3 className="font-bold">Perhatian: Ada {triggeredCount} Alert yang Sudah Menembus Target Harga!</h3>
          </div>
          <ul className="mt-2 list-inside list-disc text-xs space-y-1">
            {alerts
              .filter((a) => a.aktif === 1 && a.triggered === 1)
              .map((a) => (
                <li key={a.id}>
                  <strong>{a.kode}</strong>: Target {a.kondisi === "DIATAS" ? "≥" : "≤"} {rp(a.target_harga)}, harga saat ini{" "}
                  <strong>{rp(a.harga_sekarang)}</strong>. {a.catatan && `(${a.catatan})`}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Add New Alert Form */}
      <Card>
        <h2 id="alert-harga-baru" className="mb-3 scroll-mt-24 text-lg font-bold text-zinc-950 dark:text-zinc-100">Pasang Alert Harga Baru</h2>
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Kode Saham
            <input
              type="text"
              placeholder="Contoh: BBCA"
              value={kode}
              maxLength={4}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm outline-none transition focus:border-green-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>

          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Kondisi
            <select
              value={kondisi}
              onChange={(e) => setKondisi(e.target.value as "DIATAS" | "DIBAWAH")}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm outline-none transition focus:border-green-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="DIATAS">Harga Naik Di Atas (&ge;)</option>
              <option value="DIBAWAH">Harga Turun Di Bawah (&le;)</option>
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Target Harga (Rp)
            <input
              type="text"
              placeholder="Contoh: 10000"
              value={targetHarga}
              onChange={(e) => setTargetHarga(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm outline-none transition focus:border-green-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>

          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Catatan
            <input
              type="text"
              placeholder="Take profit / Stoploss"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm outline-none transition focus:border-green-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>

          <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between pt-2">
            {error && <span className="text-xs font-semibold text-rose-600">{error}</span>}
            <button
              type="submit"
              disabled={submitting}
              className="ml-auto rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-60"
            >
              {submitting ? "Menyimpan..." : "+ Aktifkan Alert"}
            </button>
          </div>
        </form>
      </Card>

      {/* Alert List Table */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="font-bold text-zinc-950 dark:text-zinc-100">Daftar Alert Terpasang</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Memuat alert...</div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Belum ada alert harga yang terpasang. Tambahkan alert pertama Anda di atas!
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Saham</th>
                  <th className="px-4 py-3">Kondisi</th>
                  <th className="px-4 py-3 text-right">Target Harga</th>
                  <th className="px-4 py-3 text-right">Harga Terkini</th>
                  <th className="px-4 py-3 text-right">Jarak (%)</th>
                  <th className="px-4 py-3">Catatan</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {alerts.map((a) => {
                  const isHit = a.aktif === 1 && a.triggered === 1;
                  return (
                    <tr
                      key={a.id}
                      className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 ${
                        isHit ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        {isHit ? (
                          <span className="inline-flex animate-pulse items-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                            🎯 TERCAPAI
                          </span>
                        ) : a.aktif === 1 ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/saham/${a.kode}`}
                          className="font-bold text-green-700 hover:underline dark:text-green-400"
                        >
                          {a.kode}
                        </Link>
                        <div className="text-xs text-zinc-400 truncate max-w-[140px]">{a.nama}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {a.kondisi === "DIATAS" ? "Naik Di Atas (≥)" : "Turun Di Bawah (≤)"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {rp(a.target_harga)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                        {rp(a.harga_sekarang)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs">
                        {a.selisih_pct !== null ? (
                          <span className={a.selisih_pct >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600"}>
                            {a.selisih_pct >= 0 ? "+" : ""}
                            {num(a.selisih_pct, 1)}%
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                        {a.catatan || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => toggleAktif(a.id, a.aktif)}
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          >
                            {a.aktif === 1 ? "Matikan" : "Nyalakan"}
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            className="rounded-lg p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Hapus alert"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}

