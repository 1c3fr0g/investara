"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { compact, num, pct, rp } from "@/lib/format";
import {
  INVESTMENT_FACTORS, INVESTMENT_METRICS, INVESTMENT_LIQUIDITY, INVESTMENT_PROFILES,
  MIN_INVESTMENT_COVERAGE, MIN_INVESTMENT_PEERS, INVESTMENT_PAGE_SIZE,
  type InvestmentCandidate, type InvestmentProfile, type InvestmentResponse,
} from "@/lib/investmentRanking";
import { Card } from "./ui";
import { StarButton } from "./Watchlist";
import { StockLogo } from "./StockLogo";

const selectClass = "ios-glass-pill mt-1 w-full min-w-0 min-h-10 rounded-xl px-3 text-sm";
const secondaryButton = "ios-glass-pill control-button rounded-xl text-xs font-semibold disabled:opacity-45";
const wib = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
const points = (value: number) => num(value, 0);

type Result = { key: string; data: InvestmentResponse } | { key: string; error: string };

export function InvestmentSelection() {
  const [profileId, setProfileId] = useState<InvestmentProfile>("seimbang");
  const [sector, setSector] = useState("");
  const [liquidity, setLiquidity] = useState(0);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const anchor = useRef<HTMLHeadingElement>(null);
  const profile = INVESTMENT_PROFILES.find(({ id }) => id === profileId) ?? INVESTMENT_PROFILES[0];
  const query = new URLSearchParams({
    profil: profile.id, sektor: sector, likuiditas: String(liquidity), halaman: String(page),
  }).toString();
  const key = query + ":" + retry;
  const response = result?.key === key && "data" in result ? result.data : null;
  const error = result?.key === key && "error" in result ? result.error : "";
  const sectors = (result && "data" in result ? result.data.sectors : null) ?? (sector ? [sector] : []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/seleksi-investasi?" + query, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Gagal memuat kandidat.");
        if (!controller.signal.aborted) setResult({ key, data: body });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ key, error: err instanceof Error ? err.message : "Gagal memuat kandidat." });
        }
      });
    return () => controller.abort();
  }, [key, query]);

  function toggle(code: string) {
    setSelection((current) => {
      if (current.includes(code)) return current.filter((selected) => selected !== code);
      return current.length < 4 ? [...current, code] : current;
    });
  }

  function goToPage(next: number) {
    setPage(next);
    anchor.current?.focus({ preventScroll: true });
    anchor.current?.scrollIntoView({ block: "start" });
  }

  return (
    <main className="screen-shell screen-section space-y-5">
      <header className="crystal-intro flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="crystal-title">Seleksi Saham Investasi</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Susun daftar riset dari profitabilitas, valuasi, pertumbuhan, dan dividen. Bandingkan angka setiap saham dengan emiten di sektornya.
          </p>
        </div>
        <Link href="/" className={secondaryButton}>Kembali ke Screener</Link>
      </header>

      <Card className="space-y-4">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-semibold">Profil seleksi</legend>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {INVESTMENT_PROFILES.map((option) => (
              <button key={option.id} type="button" aria-pressed={profileId === option.id}
                onClick={() => { setProfileId(option.id); setPage(1); }}
                className={`control-button rounded-xl text-sm font-semibold ${profileId === option.id ? "crystal-active" : "ios-glass-pill"}`}>
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
          {INVESTMENT_FACTORS.filter(({ key }) => profile.weights[key] > 0).map(({ key, label }) => (
            <span key={key}>{label} <strong className="text-foreground">{profile.weights[key]}%</strong></span>
          ))}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">
            Sektor
            <select className={selectClass} value={sector} onChange={(event) => { setSector(event.target.value); setPage(1); }}>
              <option value="">Semua sektor</option>
              {sectors.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Nilai transaksi minimum pada snapshot
            <select className={selectClass} value={liquidity} onChange={(event) => { setLiquidity(Number(event.target.value)); setPage(1); }}>
              {INVESTMENT_LIQUIDITY.map((value) => <option key={value} value={value}>{value ? "Rp " + (value / 1e9).toLocaleString("id-ID") + " miliar" : "Semua nilai"}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {selection.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span>Perbandingan ({selection.length}/4)</span>
            {selection.map((code) => (
              <button key={code} type="button" onClick={() => toggle(code)} aria-label={"Lepas " + code}
                className="ios-glass-subtle min-h-9 rounded-lg px-2.5">{code} ×</button>
            ))}
          </div>
          {selection.length >= 2
            ? <Link href={"/bandingkan?k=" + encodeURIComponent(selection.join(","))} className="crystal-primary control-button rounded-xl text-xs font-bold">Bandingkan saham</Link>
            : <span className="text-xs text-zinc-600 dark:text-zinc-400">Pilih satu saham lagi.</span>}
        </Card>
      )}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 ref={anchor} tabIndex={-1} className="scroll-mt-28 text-lg font-bold">Kandidat untuk diriset</h2>
        {response && (
          <p role="status" className="text-xs text-zinc-600 dark:text-zinc-400">
            {response.total.toLocaleString("id-ID")} dari {response.considered.toLocaleString("id-ID")} saham memenuhi syarat · {wib.format(response.updatedAt)} WIB
          </p>
        )}
      </div>

      {error ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p role="alert" className="text-sm">{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className={secondaryButton}>Coba lagi</button>
        </Card>
      ) : !response ? (
        <Card><p role="status" className="text-sm">Memuat dan membandingkan saham per sektor…</p></Card>
      ) : response.total === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm">Belum ada kandidat yang memenuhi cakupan data dan kriteria pilihan ini.</p>
          <button type="button" className={secondaryButton}
            onClick={() => { setSector(""); setLiquidity(0); setProfileId("seimbang"); setPage(1); }}>Reset pilihan</button>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {response.items.map((item, index) => (
              <Candidate key={item.kode} item={item} rank={(response.page - 1) * INVESTMENT_PAGE_SIZE + index + 1}
                selected={selection.includes(item.kode)} full={selection.length === 4} onToggle={() => toggle(item.kode)} />
            ))}
          </div>
          {response.pages > 1 && (
            <nav aria-label="Halaman kandidat" className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" disabled={response.page === 1} onClick={() => goToPage(response.page - 1)} className={secondaryButton}>Sebelumnya</button>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">Halaman {response.page} dari {response.pages}</span>
              <button type="button" disabled={response.page === response.pages} onClick={() => goToPage(response.page + 1)} className={secondaryButton}>Berikutnya</button>
            </nav>
          )}
        </>
      )}

      <Card className="p-4 sm:p-5">
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Cara skor dihitung</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            <li>Setiap metrik diberi peringkat relatif terhadap emiten di sektor yang sama, dengan minimal {MIN_INVESTMENT_PEERS} observasi per metrik termasuk saham tersebut. Penyaringan nilai transaksi tidak mengubah kelompok pembanding.</li>
            <li>Bobot mengikuti profil yang dipilih. Kandidat memerlukan cakupan minimal {MIN_INVESTMENT_COVERAGE}% dari bobot metrik serta data pembanding untuk faktor wajib. Metrik kosong memakai skor netral 50 dalam perhitungan.</li>
            <li>PER dan PBV nonpositif tidak mendapat peringkat valuasi. Profil Dividen mensyaratkan yield positif serta estimasi payout di atas 0% hingga 100%. Yield historis dapat berubah.</li>
            <li>Papan Akselerasi dan Pemantauan Khusus dikeluarkan. Data menggunakan snapshot screener Investara dari Yahoo Finance dan TradingView. Waktu snapshot mencakup waktu pengambilan, sementara tanggal laporan tiap emiten dapat berbeda.</li>
            <li>Skor menunjukkan posisi relatif dalam data yang tersedia saat snapshot dan dapat dipakai untuk menentukan prioritas riset.</li>
          </ul>
        </details>
      </Card>
    </main>
  );
}

function Candidate({ item, rank, selected, full, onToggle }: {
  item: InvestmentCandidate; rank: number; selected: boolean; full: boolean; onToggle: () => void;
}) {
  return (
    <Card className="space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-44 items-center gap-2.5">
          <span className="min-w-7 text-center text-xs font-bold tabular-nums text-zinc-600 dark:text-zinc-400">{rank}</span>
          <div className="shrink-0"><StockLogo kode={item.kode} size="sm" /></div>
          <div className="min-w-0">
            <Link href={"/saham/" + item.kode} className="text-sm font-bold text-blue-700 hover:underline dark:text-blue-300">{item.kode}</Link>
            <p className="wrap-anywhere text-xs text-zinc-600 dark:text-zinc-400">{item.nama} · {item.sektor}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="ios-glass-subtle rounded-xl px-2.5 py-1.5 text-xs tabular-nums" aria-label={`Skor ${points(item.score)} dari 100`}>
            Skor <strong>{points(item.score)}/100</strong>
          </div>
          <StarButton kode={item.kode} className="icon-button rounded-xl" />
          <Link href={"/alerts?kode=" + item.kode + "#alert-harga-baru"} className={secondaryButton} aria-label={"Pasang alert " + item.kode}>
            Pasang alert
          </Link>
          <button type="button" aria-pressed={selected} disabled={full && !selected} onClick={onToggle}
            className={selected ? "crystal-active control-button rounded-xl text-xs font-semibold" : secondaryButton}
            aria-label={`Bandingkan ${item.kode}`}>{selected ? "Dipilih" : "Bandingkan"}</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <span>{rp(item.harga)}</span>
        <span>Nilai transaksi {compact(item.nilai)}</span>
        <span>Cakupan {points(item.coverage)}%</span>
        {item.flags.map((flag) => <span key={flag} className="font-semibold text-amber-800 dark:text-amber-300">{flag}</span>)}
      </div>
      <details className="border-t border-zinc-200/75 pt-2.5 dark:border-white/10">
        <summary className="cursor-pointer text-xs font-semibold text-blue-700 dark:text-blue-300">Rincian skor dan pembanding</summary>
        <div className="table-scroll mt-3">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th scope="col" className="p-2">Metrik</th>
                <th scope="col" className="p-2 text-right">Saham</th>
                <th scope="col" className="p-2 text-right">Median sektor</th>
                <th scope="col" className="p-2 text-right">Skor</th>
              </tr>
            </thead>
            {item.factors.map((factor) => (
              <tbody key={factor.key} className="border-b border-zinc-200/75 dark:border-white/10">
                <tr><th scope="rowgroup" colSpan={4} className="p-2 font-semibold">{INVESTMENT_FACTORS.find(({ key }) => key === factor.key)?.label}</th></tr>
                {factor.metrics.map((metric) => {
                  const definition = INVESTMENT_METRICS[metric.key];
                  const formatted = (value: number | null) => value === null ? "—" : definition.ratio ? num(value, 2) + "×" : pct(value, 2);
                  return (
                    <tr key={metric.key} className="tabular-nums">
                      <th scope="row" className="p-2 font-medium">{definition.label}</th>
                      <td className="p-2 text-right">{formatted(metric.value)}</td>
                      <td className="p-2 text-right">{formatted(metric.median)} {metric.peers >= MIN_INVESTMENT_PEERS && <span className="text-zinc-600 dark:text-zinc-400">({metric.peers})</span>}</td>
                      <td className="p-2 text-right">{metric.percentile === null ? "—" : points(metric.percentile)}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          Estimasi payout {pct(item.payout, 1)} · DER {pct(item.der, 1)}
        </p>
      </details>
    </Card>
  );
}
