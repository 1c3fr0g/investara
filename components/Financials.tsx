"use client";

import { useEffect, useState } from "react";
import type { LaporanResponse, LaporanRow } from "@/lib/types";
import { compactNum, num, pct } from "@/lib/format";
import { Card } from "./ui";

type Mode = "tahunan" | "kuartalan";
type MetricKey = "pendapatan" | "laba" | "fcf";
const METRICS: { key: MetricKey; label: string }[] = [
  { key: "pendapatan", label: "Pendapatan" },
  { key: "laba", label: "Laba bersih" },
  { key: "fcf", label: "Free cash flow" },
];

const periode = (tgl: string, mode: Mode) => {
  const d = new Date(tgl);
  return mode === "tahunan" ? String(d.getUTCFullYear()) : `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${String(d.getUTCFullYear()).slice(2)}`;
};

const ratio = (a: number | null, b: number | null) => (a !== null && b !== null && b !== 0 ? (a / b) * 100 : null);

function Bars({ rows, metric, mode }: { rows: LaporanRow[]; metric: MetricKey; mode: Mode }) {
  const vals = rows.map((r) => r[metric]);
  const max = Math.max(...vals.map((v) => Math.abs(v ?? 0)), 1);
  return (
    <div className="flex h-56 items-center gap-2">
      {rows.map((r, i) => {
        const v = vals[i];
        const h = v === null ? 0 : Math.max((Math.abs(v) / max) * 42, 1.5);
        return (
          <div key={r.tanggal} className="flex h-full flex-1 flex-col items-center text-center">
            <div className="flex h-1/2 w-full flex-col items-center justify-end gap-1">
              {v !== null && v >= 0 && (
                <>
                  <span className="text-[11px] font-medium tabular-nums text-green-800">{compactNum(v)}</span>
                  <div className="w-full rounded-t-md bg-green-500" style={{ height: `${h * 2}%` }} />
                </>
              )}
            </div>
            <div className="h-px w-full bg-green-100" />
            <div className="flex h-1/2 w-full flex-col items-center justify-start gap-1">
              {v !== null && v < 0 && (
                <>
                  <div className="w-full rounded-b-md bg-red-500" style={{ height: `${h * 2}%` }} />
                  <span className="text-[11px] font-medium tabular-nums text-red-600">{compactNum(v)}</span>
                </>
              )}
              <span className="mt-auto text-xs text-green-800/60">{periode(r.tanggal, mode)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Financials({ kode }: { kode: string }) {
  const [state, setState] = useState<{ kode: string; data?: LaporanResponse; error?: string } | null>(null);
  const [mode, setMode] = useState<Mode>("tahunan");
  const [metric, setMetric] = useState<MetricKey>("laba");

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/saham/${kode}/laporan`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Gagal mengambil laporan");
        setState({ kode, data: j });
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setState({ kode, error: e instanceof Error ? e.message : String(e) });
      });
    return () => ctrl.abort();
  }, [kode]);

  const loading = !state || state.kode !== kode;
  const all = state?.data?.[mode] ?? [];
  const rows = all.slice(mode === "tahunan" ? -6 : -8);

  const tab = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-green-600 text-white" : "border border-green-200 text-green-800 hover:bg-green-50"}`;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-green-950">Laporan keuangan</h2>
        <div className="flex gap-2">
          <button className={tab(mode === "tahunan")} onClick={() => setMode("tahunan")}>Tahunan</button>
          <button className={tab(mode === "kuartalan")} onClick={() => setMode("kuartalan")}>Kuartalan</button>
        </div>
      </div>

      {loading && <p className="py-8 text-center text-sm text-green-800/70">Memuat laporan keuangan...</p>}
      {!loading && state?.error && <p className="py-6 text-sm text-green-900">Gagal memuat laporan: {state.error}</p>}
      {!loading && !state?.error && rows.length === 0 && <p className="py-6 text-center text-sm text-green-800/70">Laporan keuangan belum tersedia untuk saham ini.</p>}

      {rows.length > 0 && (
        <>
          <div className="mb-2 flex flex-wrap gap-2">
            {METRICS.map((m) => (
              <button key={m.key} className={tab(metric === m.key)} onClick={() => setMetric(m.key)}>{m.label}</button>
            ))}
          </div>
          <Bars rows={rows} metric={metric} mode={mode} />

          <div className="mt-4 table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-green-100 bg-green-50/60 text-green-800">
                  <th className="px-3 py-2 text-left font-medium">Periode</th>
                  <th className="px-3 py-2 text-right font-medium">Pendapatan</th>
                  <th className="px-3 py-2 text-right font-medium">Laba bersih</th>
                  <th className="px-3 py-2 text-right font-medium">Margin</th>
                  <th className="px-3 py-2 text-right font-medium">Growth laba</th>
                  <th className="px-3 py-2 text-right font-medium">Ekuitas</th>
                  <th className="px-3 py-2 text-right font-medium">Utang</th>
                  <th className="px-3 py-2 text-right font-medium">DER</th>
                  {mode === "tahunan" && <th className="px-3 py-2 text-right font-medium">ROE</th>}
                  {mode === "tahunan" && <th className="px-3 py-2 text-right font-medium">EPS</th>}
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => {
                  const t = new Date(r.tanggal).getTime();
                  const prev = all.find((x) => Math.abs(t - new Date(x.tanggal).getTime() - 365 * 864e5) < 20 * 864e5) ?? null;
                  const growth = prev && prev.laba !== null && prev.laba > 0 && r.laba !== null ? ((r.laba - prev.laba) / prev.laba) * 100 : null;
                  return (
                    <tr key={r.tanggal} className="border-b border-green-50 last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-green-950">{periode(r.tanggal, mode)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{compactNum(r.pendapatan)}</td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${(r.laba ?? 0) < 0 ? "text-red-600" : ""}`}>{compactNum(r.laba)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(ratio(r.laba, r.pendapatan), 1)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${growth === null ? "" : growth >= 0 ? "text-green-700" : "text-red-600"}`}>{pct(growth, 1)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{compactNum(r.ekuitas)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{compactNum(r.utang)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(ratio(r.utang, r.ekuitas), 1)}</td>
                      {mode === "tahunan" && <td className="px-3 py-2 text-right tabular-nums">{pct(ratio(r.laba, r.ekuitas), 1)}</td>}
                      {mode === "tahunan" && <td className="px-3 py-2 text-right tabular-nums">{num(r.eps, 2)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-green-800/60">
            Sumber: Yahoo Finance. Nilai dalam mata uang laporan emiten (sebagian melaporkan dalam USD), M = miliar. DER di sini = total utang / ekuitas. Growth dibandingkan periode yang sama tahun lalu bila tersedia.
          </p>
        </>
      )}
    </Card>
  );
}
