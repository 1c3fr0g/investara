"use client";

import { useMemo, useState } from "react";
import { LineChart } from "./Charts";
import { Card } from "./ui";
import { compact, num, rp } from "@/lib/format";

type Row = {
  tahun: number;
  modal: number;
  nilai: number;
  dividenGross: number;
  pajak: number;
  dividenNet: number;
  kumulatifCash: number;
  total: number;
  lots: number;
};

function projectDRIP(
  initial: number,
  monthly: number,
  growth: number,
  yieldPct: number,
  reinvest: boolean,
  applyTax: boolean,
  years: number,
  currentPrice: number | null
): Row[] {
  const mg = Math.pow(1 + growth / 100, 1 / 12) - 1;
  const my = yieldPct / 100 / 12;
  const taxRate = applyTax ? 0.1 : 0.0; // PPh Final 10% vs UU HPP 0%

  let value = initial;
  let invested = initial;
  let cash = 0;
  let stockPrice = currentPrice || 1000;
  let shares = initial / stockPrice;

  const rows: Row[] = [];

  for (let y = 1; y <= years; y++) {
    let yearGross = 0;
    let yearTax = 0;
    let yearNet = 0;

    for (let i = 0; i < 12; i++) {
      const grossDiv = value * my;
      const tax = grossDiv * taxRate;
      const netDiv = grossDiv - tax;

      yearGross += grossDiv;
      yearTax += tax;
      yearNet += netDiv;

      if (reinvest) {
        value += netDiv;
        // DRIP buys additional shares
        const newShares = netDiv / stockPrice;
        shares += newShares;
      } else {
        cash += netDiv;
      }

      stockPrice = stockPrice * (1 + mg);
      value = value * (1 + mg) + monthly;
      invested += monthly;
      shares += monthly / stockPrice;
    }

    rows.push({
      tahun: y,
      modal: invested,
      nilai: value,
      dividenGross: yearGross,
      pajak: yearTax,
      dividenNet: yearNet,
      kumulatifCash: cash,
      total: value + cash,
      lots: Math.floor(shares / 100),
    });
  }
  return rows;
}

const field =
  "mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100";

function Money({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
      {label}
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">Rp</span>
        <input
          inputMode="numeric"
          value={value.toLocaleString("id-ID")}
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
          className={`${field} pl-9`}
        />
      </div>
    </label>
  );
}

export function Calculator({
  kode,
  harga,
  yieldPct,
}: {
  kode: string;
  harga: number | null;
  yieldPct: number | null;
}) {
  const [initial, setInitial] = useState(10_000_000);
  const [monthly, setMonthly] = useState(0);
  const [yld, setYld] = useState(Math.round((yieldPct ?? 0) * 10) / 10);
  const [growth, setGrowth] = useState(5);
  const [years, setYears] = useState(10);
  const [reinvest, setReinvest] = useState(true);
  const [applyTax, setApplyTax] = useState(true);

  const rows = useMemo(
    () => projectDRIP(initial, monthly, growth, yld, reinvest, applyTax, years, harga),
    [initial, monthly, growth, yld, reinvest, applyTax, years, harga]
  );

  const withoutDRIPRows = useMemo(
    () => projectDRIP(initial, monthly, growth, yld, false, applyTax, years, harga),
    [initial, monthly, growth, yld, applyTax, years, harga]
  );

  const last = rows[rows.length - 1];
  const lastWithout = withoutDRIPRows[withoutDRIPRows.length - 1];
  const dripAdvantage = last.total - lastWithout.total;

  const totalNetDiv = rows.reduce((s, r) => s + r.dividenNet, 0);
  const totalTax = rows.reduce((s, r) => s + r.pajak, 0);

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">
              Kalkulator Proyeksi DRIP & Dividen {kode}
            </h2>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Pajak 10% Otomatis
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Simulasi Dividend Reinvestment Plan (DRIP) dengan perhitungan pajak dividen PPh Final 10% atau bebas pajak UU HPP.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Controls Column */}
        <div className="space-y-4">
          <Money label="Modal Investasi Awal" value={initial} onChange={setInitial} />
          <Money label="Tabungan Rutin / Bulan" value={monthly} onChange={setMonthly} />

          <label className="block text-sm text-zinc-800 dark:text-zinc-200">
            <div className="flex justify-between font-medium">
              <span>Dividend Yield Rata-Rata</span>
              <b className="text-green-700 dark:text-green-400">{num(yld, 1)}%</b>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              step={0.1}
              value={yld}
              onChange={(e) => setYld(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>

          <label className="block text-sm text-zinc-800 dark:text-zinc-200">
            <div className="flex justify-between font-medium">
              <span>Kenaikan Harga Saham (Capital Gain) / Tahun</span>
              <b className="text-green-700 dark:text-green-400">{num(growth, 1)}%</b>
            </div>
            <input
              type="range"
              min={-10}
              max={30}
              step={0.5}
              value={growth}
              onChange={(e) => setGrowth(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>

          <label className="block text-sm text-zinc-800 dark:text-zinc-200">
            <div className="flex justify-between font-medium">
              <span>Jangka Waktu Simulasi</span>
              <b className="text-green-700 dark:text-green-400">{years} Tahun</b>
            </div>
            <input
              type="range"
              min={1}
              max={40}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>

          {/* Toggle Switches */}
          <div className="space-y-2.5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              <span>Reinvestasi Dividen (DRIP)</span>
              <input
                type="checkbox"
                checked={reinvest}
                onChange={(e) => setReinvest(e.target.checked)}
                className="h-4 w-4 rounded accent-green-600"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              <div>
                <span>Potong PPh Final 10%</span>
                <span className="block text-[11px] font-normal text-zinc-500">
                  {applyTax ? "PPh Final Pasal 4 ayat 2 (10%)" : "Bebas Pajak (UU HPP Reinvestasi)"}
                </span>
              </div>
              <input
                type="checkbox"
                checked={applyTax}
                onChange={(e) => setApplyTax(e.target.checked)}
                className="h-4 w-4 rounded accent-green-600"
              />
            </label>
          </div>

          {harga && (
            <div className="rounded-xl bg-green-50/70 p-3 text-xs text-green-900 dark:bg-zinc-800 dark:text-zinc-300">
              Harga saat ini {rp(harga)}. Modal awal setara sekitar{" "}
              <strong>{Math.floor(initial / (harga * 100))} lot</strong>.
              {reinvest && (
                <span className="mt-1 block font-semibold text-green-700 dark:text-green-400">
                  Pada tahun ke-{years}, jumlah kepemilikan diproyeksikan bertambah menjadi {last.lots} lot melalui DRIP!
                </span>
              )}
            </div>
          )}
        </div>

        {/* Results Column */}
        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Modal Masuk</span>
              <div className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">{compact(last.modal)}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Total Dividen Bersih</span>
              <div className="mt-1.5 text-xl font-bold text-emerald-600 dark:text-emerald-400">{compact(totalNetDiv)}</div>
              {applyTax && (
                <span className="text-xs text-zinc-400">Pajak 10%: {compact(totalTax)}</span>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Passive Income / Thn ({years} thn)</span>
              <div className="mt-1.5 text-xl font-bold text-zinc-900 dark:text-zinc-100">{compact(last.dividenNet)}</div>
              <span className="text-xs text-zinc-400">Rp {compact(last.dividenNet / 12)} / bulan</span>
            </div>

            <div className="rounded-2xl bg-emerald-600 p-4 sm:p-5 text-white shadow-xs shadow-emerald-700/20">
              <span className="text-xs font-semibold text-emerald-100">Total Nilai Portofolio</span>
              <div className="mt-1.5 text-xl font-extrabold">{compact(last.total)}</div>
              <span className="text-xs text-emerald-100">
                Return: {last.modal > 0 ? num(((last.total - last.modal) / last.modal) * 100, 1) : 0}%
              </span>
            </div>
          </div>

          {/* DRIP Compounding Advantage Callout */}
          {reinvest && dripAdvantage > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <span>
                💡 <strong>Kekuatan Efek Compounding DRIP:</strong> Dengan reinvestasi dividen, kekayaan Anda lebih tinggi{" "}
                <strong>{compact(dripAdvantage)}</strong> dibanding dividen ditarik tunai!
              </span>
            </div>
          )}

          {/* Growth Chart */}
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                Grafik Pertumbuhan Nilai Portofolio ({years} Tahun)
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" /> Total Nilai
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-zinc-400" /> Modal
                </span>
              </div>
            </div>
            <LineChart
              series={[
                { values: rows.map((r) => r.modal), stroke: "stroke-zinc-400 dark:stroke-zinc-600", dashed: true },
                { values: rows.map((r) => r.total), stroke: "stroke-emerald-600", fill: "fill-emerald-500/10" },
              ]}
              xLabels={["Tahun 1", `Tahun ${years}`]}
              formatY={compact}
            />
          </div>

          {/* Breakdown Table */}
          <div className="max-h-60 overflow-y-auto table-scroll rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-right text-xs">
              <thead className="sticky top-0 bg-zinc-50 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">Tahun</th>
                  <th className="px-3 py-2">Kepemilikan</th>
                  <th className="px-3 py-2">Modal</th>
                  <th className="px-3 py-2">Dividen Gross</th>
                  {applyTax && <th className="px-3 py-2">PPh 10%</th>}
                  <th className="px-3 py-2">Dividen Net</th>
                  <th className="px-3 py-2 font-bold">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((r) => (
                  <tr key={r.tahun} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-3 py-2 text-left font-medium text-zinc-900 dark:text-zinc-100">Ke-{r.tahun}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">{r.lots} lot</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">{compact(r.modal)}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">{compact(r.dividenGross)}</td>
                    {applyTax && (
                      <td className="px-3 py-2 tabular-nums text-rose-500">{compact(r.pajak)}</td>
                    )}
                    <td className="px-3 py-2 tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {compact(r.dividenNet)}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
                      {compact(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  );
}
