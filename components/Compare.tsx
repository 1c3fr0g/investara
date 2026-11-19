"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Detail, ListResponse } from "@/lib/types";
import { compact, num, pct, rp } from "@/lib/format";
import { Card } from "./ui";
import { StarButton } from "./Watchlist";

const COLORS = ["#16a34a", "#2563eb", "#d97706", "#9333ea"];
const MAX = 4;

type Metric = { label: string; get: (d: Detail) => number | null; fmt: (v: number | null) => string; better?: "high" | "low" };
const x = (v: number | null) => (v === null ? "-" : `${num(v, 2)}x`);

const GROUPS: { title: string; metrics: Metric[] }[] = [
  {
    title: "Ringkasan",
    metrics: [
      { label: "Skor analisis", get: (d) => d.analisis.score, fmt: (v) => (v === null ? "-" : `${v}/100`), better: "high" },
      { label: "Harga", get: (d) => d.harga, fmt: rp },
      { label: "Perubahan hari ini", get: (d) => d.perubahan_pct, fmt: (v) => pct(v), better: "high" },
      { label: "Market cap", get: (d) => d.mcap, fmt: compact },
    ],
  },
  {
    title: "Dividen",
    metrics: [
      { label: "Dividend yield", get: (d) => d.yield_pct, fmt: (v) => pct(v), better: "high" },
      { label: "DPS 12 bulan", get: (d) => d.dps_12m, fmt: rp, better: "high" },
      { label: "Payout ratio", get: (d) => d.payout_pct, fmt: (v) => pct(v, 1) },
      { label: "Tahun berturut-turut", get: (d) => d.tahun_berturut, fmt: (v) => (v === null ? "-" : `${v} tahun`), better: "high" },
      { label: "CAGR DPS 5 thn", get: (d) => d.cagr_dps_pct, fmt: (v) => pct(v, 1), better: "high" },
    ],
  },
  {
    title: "Valuasi",
    metrics: [
      { label: "PER", get: (d) => (d.per && d.per > 0 ? d.per : null), fmt: x, better: "low" },
      { label: "PBV", get: (d) => d.pbv, fmt: x, better: "low" },
      { label: "EPS", get: (d) => d.eps, fmt: (v) => num(v, 2), better: "high" },
      { label: "Potensi ke target analis", get: (d) => (d.target_rata && d.harga ? (d.target_rata / d.harga - 1) * 100 : null), fmt: (v) => pct(v, 1), better: "high" },
    ],
  },
  {
    title: "Profitabilitas & pertumbuhan",
    metrics: [
      { label: "ROE", get: (d) => d.roe_pct, fmt: (v) => pct(v, 1), better: "high" },
      { label: "ROA", get: (d) => d.roa_pct, fmt: (v) => pct(v, 1), better: "high" },
      { label: "Margin laba bersih", get: (d) => d.margin_laba_pct, fmt: (v) => pct(v, 1), better: "high" },
      { label: "Pertumbuhan laba", get: (d) => d.pertumbuhan_laba_pct, fmt: (v) => pct(v, 1), better: "high" },
      { label: "Pertumbuhan omzet", get: (d) => d.pertumbuhan_pendapatan_pct, fmt: (v) => pct(v, 1), better: "high" },
    ],
  },
  {
    title: "Risiko & Likuiditas",
    metrics: [
      { label: "Debt to equity (DER)", get: (d) => d.der, fmt: (v) => pct(v, 1), better: "low" },
      { label: "Beta", get: (d) => d.beta, fmt: (v) => num(v, 2), better: "low" },
      { label: "Harga vs MA200", get: (d) => (d.ma200 && d.harga ? (d.harga / d.ma200 - 1) * 100 : null), fmt: (v) => pct(v, 1) },
    ],
  },
];

function best(vals: (number | null)[], better?: "high" | "low"): number | null {
  if (!better) return null;
  const valid = vals.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v !== null && Number.isFinite(x.v));
  if (valid.length < 2) return null;
  valid.sort((a, b) => (better === "high" ? b.v - a.v : a.v - b.v));
  return valid[0].v === valid[1].v ? null : valid[0].i;
}

function PriceChart({ details }: { details: Detail[] }) {
  const series = details.map((d) => ({
    kode: d.kode,
    data: (d.riwayat_harga ?? []).map((r) => ({ t: r.t, p: r.c })),
  })).filter((s) => s.data.length > 5);

  if (series.length < 2) return null;

  const tStart = Math.max(...series.map((s) => s.data[0].t));
  const tEnd = Math.min(...series.map((s) => s.data[s.data.length - 1].t));
  if (tStart >= tEnd) return null;

  const normed = series.map((s) => {
    const trimmed = s.data.filter((p) => p.t >= tStart && p.t <= tEnd);
    const base = trimmed[0]?.p || 1;
    return {
      kode: s.kode,
      points: trimmed.map((p) => ({ t: p.t, v: (p.p / base) * 100 })),
    };
  });

  const allVals = normed.flatMap((s) => s.points.map((p) => p.v));
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const rangeV = maxV - minV || 1;

  const w = 720;
  const h = 220;
  const pad = 24;

  const toX = (t: number) => pad + ((t - tStart) / (tEnd - tStart)) * (w - pad * 2);
  const toY = (v: number) => h - pad - ((v - minV) / rangeV) * (h - pad * 2);

  return (
    <div className="w-full overflow-x-auto pt-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[540px]">
        <line x1={pad} y1={toY(100)} x2={w - pad} y2={toY(100)} stroke="#94a3b8" strokeDasharray="3 3" opacity={0.5} />
        {normed.map((s, idx) => {
          const path = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.t).toFixed(1)} ${toY(p.v).toFixed(1)}`).join(" ");
          return <path key={s.kode} d={path} fill="none" stroke={COLORS[idx % COLORS.length]} strokeWidth={2.5} strokeLinecap="round" />;
        })}
      </svg>
    </div>
  );
}

export function Compare() {
  const router = useRouter();
  const sp = useSearchParams();
  const codes = useMemo(
    () => [...new Set((sp.get("k") ?? "").toUpperCase().split(",").filter((k) => /^[A-Z0-9]{4}$/.test(k)))].slice(0, MAX),
    [sp],
  );
  const [cache, setCache] = useState<Record<string, Detail | null>>({});
  const [q, setQ] = useState("");
  const [saran, setSaran] = useState<{ kode: string; nama: string }[]>([]);

  const setCodes = (next: string[]) => router.replace(next.length ? `/bandingkan?k=${next.join(",")}` : "/bandingkan", { scroll: false });

  useEffect(() => {
    for (const k of codes) {
      if (k in cache) continue;
      fetch(`/api/saham/${k}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Detail | null) => setCache((p) => ({ ...p, [k]: d })))
        .catch(() => setCache((p) => ({ ...p, [k]: null })));
    }
  }, [codes, cache]);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/saham?q=${encodeURIComponent(term)}&size=6&sort=mcap&dir=desc`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: ListResponse | null) => j && setSaran(j.items.map((i) => ({ kode: i.kode, nama: i.nama }))))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const details = codes.map((k) => cache[k]).filter((d): d is Detail => !!d);
  const loading = codes.some((k) => !(k in cache));

  function tambah(kode: string) {
    if (codes.includes(kode) || codes.length >= MAX) return;
    setCodes([...codes, kode]);
    setQ("");
    setSaran([]);
  }

  return (
    <main className="screen-shell space-y-8 screen-section">
      <div className="crystal-intro space-y-1">
        <h1 className="crystal-title">Bandingkan Saham</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pilih 2–{MAX} saham untuk membandingkan statistik &amp; rasio fundamental berdampingan. Nilai terbaik per baris ditandai bintang hijau.
        </p>
      </div>

      <Card className="p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {codes.map((k, i) => (
            <span
              key={k}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1.5 pl-3.5 pr-1.5 text-xs font-bold text-zinc-800 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i] }} />
              {k}
              <button
                onClick={() => setCodes(codes.filter((c) => c !== k))}
                aria-label={`Hapus ${k}`}
                className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
              >
                ×
              </button>
            </span>
          ))}
          {codes.length < MAX && (
            <div className="relative">
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (!e.target.value.trim()) setSaran([]);
                }}
                placeholder="Tambah saham (kode/nama)..."
                className="w-64 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs outline-none focus:border-green-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              {q.trim() && saran.length > 0 && (
                <ul className="absolute z-10 mt-1.5 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                  {saran.map((s) => (
                    <li key={s.kode}>
                      <button
                        onClick={() => tambah(s.kode)}
                        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <strong className="text-green-700 dark:text-green-400">{s.kode}</strong>
                        <span className="truncate text-zinc-500 max-w-[180px]">{s.nama}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Card>

      {codes.length === 0 && (
        <Card className="p-12 text-center text-sm text-zinc-500 dark:text-zinc-400 space-y-1">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">Belum ada saham yang dipilih.</p>
          <p>Ketik kode saham di atas atau klik tombol &quot;Bandingkan&quot; pada detail saham.</p>
        </Card>
      )}
      {loading && <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Memuat data perbandingan...</p>}

      {details.length >= 1 && (
        <>
          {details.length >= 2 && (
            <Card className="p-6 sm:p-7 shadow-xs">
              <h2 className="mb-1 text-base font-bold text-zinc-950 dark:text-zinc-100">
                Kinerja Historis Harga (Dinormalisasi = 100)
              </h2>
              <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
                Grafik pergerakan harga relatif sejak tanggal awal yang sama untuk seluruh saham yang dipilih.
              </p>
              <PriceChart details={details} />
            </Card>
          )}

          <Card className="overflow-hidden p-0 shadow-xs">
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200/80 bg-zinc-50/80 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                    <th className="px-5 py-4 text-left">Metrik Rasio</th>
                    {details.map((d, i) => (
                      <th key={d.kode} className="px-5 py-4 text-right">
                        <Link
                          href={`/saham/${d.kode}`}
                          className="font-extrabold text-base hover:underline"
                          style={{ color: COLORS[codes.indexOf(d.kode)] ?? COLORS[i] }}
                        >
                          {d.kode}
                        </Link>
                        <div className="max-w-[160px] truncate text-xs font-normal text-zinc-500 dark:text-zinc-400 pt-0.5">
                          {d.nama}
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <StarButton kode={d.kode} className="icon-button rounded-xl" />
                          <Link href={"/alerts?kode=" + d.kode + "#alert-harga-baru"} className="control-button ios-glass-subtle rounded-xl text-xs font-semibold" aria-label={"Pasang alert " + d.kode}>
                            Pasang alert
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                  {GROUPS.map((g) => (
                    <FragmentRows key={g.title} title={g.title} metrics={g.metrics} details={details} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}

function FragmentRows({ title, metrics, details }: { title: string; metrics: Metric[]; details: Detail[] }) {
  return (
    <>
      <tr className="bg-zinc-50/70 dark:bg-zinc-800/40">
        <td colSpan={details.length + 1} className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
          {title}
        </td>
      </tr>
      {metrics.map((m) => {
        const vals = details.map((d) => m.get(d));
        const win = best(vals, m.better);
        return (
          <tr key={m.label} className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30">
            <td className="px-5 py-3.5 text-zinc-700 dark:text-zinc-300 font-medium">{m.label}</td>
            {vals.map((v, i) => (
              <td
                key={details[i].kode}
                className={`whitespace-nowrap px-5 py-3.5 text-right tabular-nums ${
                  win === i ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100 font-medium"
                }`}
              >
                {win === i && <span className="mr-1.5 text-emerald-600 dark:text-emerald-400 text-xs">★</span>}
                {m.fmt(v)}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}
