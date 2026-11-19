"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { Detail, ListResponse } from "@/lib/types";
import { compact, num, pct, rp } from "@/lib/format";
import { Card } from "./ui";
import { LoginButtons } from "./AuthButtons";
import { LineChart } from "./Charts";
import { StockLogo } from "./StockLogo";

type Holding = { id: string; kode: string; harga_beli: number; lot: number; transactionId?: string };

type Transaction = {
  id: string;
  kode: string;
  tipe: "BELI" | "JUAL";
  harga: number;
  lot: number;
  fee: number;
  tanggal: string;
  catatan: string | null;
  created_at: number;
  linked?: number;
};

const LEGACY_KEY = "ihsg-portofolio-v1";
const LOT = 100;

const tone = (v: number | null) => (v === null ? "" : v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400");
const sign = (v: number) => (v >= 0 ? "+" : "-");

type Row = Holding & {
  d?: Detail;
  modal: number;
  nilai: number | null;
  pl: number | null;
  plPct: number | null;
  divTahun: number | null;
  yoc: number | null;
  nilaiTarget: number | null;
  potensiPct: number | null;
};

const SECTOR_COLORS = [
  "#16a34a", // Emerald
  "#0284c7", // Sky blue
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#64748b", // Slate
  "#14b8a6", // Teal
  "#84cc16", // Lime
];

function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csvContent =
    "\uFEFF" +
    [
      headers.join(";"),
      ...rows.map((r) =>
        r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")
      ),
    ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function Portfolio() {
  const { status, data } = useSession();
  if (status === "loading")
    return <main className="screen-shell screen-section text-sm text-zinc-600 dark:text-zinc-400">Memuat portofolio...</main>;
  if (!data?.user)
    return (
      <main className="screen-shell space-y-6 screen-section">
        <h1 className="crystal-title">Portofolio</h1>
        <Card>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Masuk untuk Menyimpan Portofolio</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Portofolio, alokasi sektor, dan riwayat transaksi beli/jual Anda tersimpan aman di database.
          </p>
          <LoginButtons />
        </Card>
      </main>
    );
  return <PortfolioView />;
}

function PortfolioView() {
  const [items, setItems] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ready, setReady] = useState(false);
  const [legacy, setLegacy] = useState<Omit<Holding, "id">[]>([]);
  const pendingTrade = useRef<{ key: string; id: string } | null>(null);

  const fetchHoldings = () => {
    fetch("/api/portofolio")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items: Holding[] }) => setItems(j.items))
      .catch(() => {});
  };

  const fetchTransactions = () => {
    fetch("/api/portofolio/transaksi")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items: Transaction[] }) => setTransactions(j.items))
      .catch(() => {});
  };

  useEffect(() => {
    Promise.all([fetchHoldings(), fetchTransactions()]).finally(() => {
      try {
        const old = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]");
        if (Array.isArray(old)) setLegacy(old);
      } catch {}
      setReady(true);
    });
  }, []);

  async function tambahItem(h: Omit<Holding, "id">) {
    await tambahTransaksi({
      kode: h.kode,
      tipe: "BELI",
      harga: h.harga_beli,
      lot: h.lot,
      fee: 0,
      tanggal: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }),
      catatan: "Penambahan posisi portofolio",
    });
  }

  async function hapusItem(id: string) {
    const r = await fetch(`/api/portofolio?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.json()).error ?? "Gagal menghapus posisi");
    await fetchHoldings();
  }

  async function ubahItem(id: string, harga_beli: number, lot: number) {
    const r = await fetch("/api/portofolio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, harga_beli, lot }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Gagal mengubah posisi");
    await fetchHoldings();
  }

  async function tambahTransaksi(tx: Omit<Transaction, "id" | "created_at">) {
    const key = JSON.stringify(tx);
    if (pendingTrade.current?.key !== key) pendingTrade.current = { key, id: crypto.randomUUID() };
    const requestId = pendingTrade.current.id;
    const r = await fetch("/api/portofolio/transaksi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...tx, syncHolding: true, requestId }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Gagal menyimpan transaksi");
    if (pendingTrade.current?.id === requestId) pendingTrade.current = null;
    setItems(j.items);
    setTransactions((previous) => [j.transaction as Transaction, ...previous.filter((entry) => entry.id !== j.transaction.id)]
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.created_at - a.created_at));
  }

  async function hapusTransaksi(id: string) {
    const r = await fetch(`/api/portofolio/transaksi?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Gagal menghapus transaksi");
    setTransactions((previous) => previous.filter((transaction) => transaction.id !== id));
    setItems(j.items);
  }

  async function impor() {
    const r = await fetch("/api/portofolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: legacy.map(({ kode, harga_beli, lot }) => ({ kode, harga_beli, lot })) }),
    });
    const j = await r.json();
    if (r.ok) {
      await fetchHoldings();
      localStorage.removeItem(LEGACY_KEY);
      setLegacy([]);
    }
  }

  return (
    <PortfolioBody
      items={items}
      transactions={transactions}
      ready={ready}
      onAdd={tambahItem}
      onRemove={hapusItem}
      onEdit={ubahItem}
      onAddTx={tambahTransaksi}
      onRemoveTx={hapusTransaksi}
      legacyCount={legacy.length}
      onImport={impor}
      onDismissLegacy={() => {
        localStorage.removeItem(LEGACY_KEY);
        setLegacy([]);
      }}
    />
  );
}

function PortfolioBody({
  items,
  transactions,
  ready,
  onAdd,
  onRemove,
  onEdit,
  onAddTx,
  onRemoveTx,
  legacyCount,
  onImport,
  onDismissLegacy,
}: {
  items: Holding[];
  transactions: Transaction[];
  ready: boolean;
  onAdd: (h: Omit<Holding, "id">) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onEdit: (id: string, harga_beli: number, lot: number) => Promise<void>;
  onAddTx: (tx: Omit<Transaction, "id" | "created_at">) => Promise<void>;
  onRemoveTx: (id: string) => Promise<void>;
  legacyCount: number;
  onImport: () => void;
  onDismissLegacy: () => void;
}) {
  const [tab, setTab] = useState<"ringkasan" | "saham" | "transaksi">("ringkasan");
  const [details, setDetails] = useState<Record<string, Detail | null>>({});
  const [ihsg, setIhsg] = useState<{ harga: number | null; perubahan_pct: number | null } | null>(null);

  // Form states
  const [kode, setKode] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [saran, setSaran] = useState<{ kode: string; nama: string }[]>([]);
  const [harga, setHarga] = useState("");
  const [lot, setLot] = useState("");
  const [err, setErr] = useState("");
  const [positionError, setPositionError] = useState("");

  // Edit holding states
  const [editing, setEditing] = useState<Holding | null>(null);
  const [editHarga, setEditHarga] = useState("");
  const [editLot, setEditLot] = useState("");
  const [editErr, setEditErr] = useState("");

  function openEdit(h: Holding) {
    setEditing(h);
    setEditHarga(String(h.harga_beli));
    setEditLot(String(h.lot));
    setEditErr("");
  }

  async function simpanEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const h = Number(editHarga.replace(/[^\d.]/g, ""));
    const l = Number(editLot.replace(/[^\d.]/g, ""));
    if (!(h > 0)) return setEditErr("Harga beli harus lebih dari 0.");
    if (!(l > 0)) return setEditErr("Jumlah lot harus lebih dari 0.");
    setEditErr("");
    try {
      await onEdit(editing.id, h, l);
      setEditing(null);
    } catch (err2) {
      setEditErr(err2 instanceof Error ? err2.message : "Gagal mengubah");
    }
  }

  // Transaction form states
  const [txTipe, setTxTipe] = useState<"BELI" | "JUAL">("BELI");
  const [txKode, setTxKode] = useState("");
  const [txHarga, setTxHarga] = useState("");
  const [txLot, setTxLot] = useState("");
  const [txTanggal, setTxTanggal] = useState("");

  useEffect(() => {
    setTxTanggal(new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }));
  }, []);
  const [txFee, setTxFee] = useState("0");
  const [txCatatan, setTxCatatan] = useState("");
  const [txErr, setTxErr] = useState("");

  const [growth, setGrowth] = useState("8");
  const [divGrowth, setDivGrowth] = useState("5");

  const kodes = useMemo(() => [...new Set(items.map((i) => i.kode))], [items]);

  useEffect(() => {
    // Fetch IHSG benchmark
    fetch("/api/ihsg")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setIhsg({ harga: j.harga, perubahan_pct: j.perubahan_pct }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    for (const k of kodes) {
      if (k in details) continue;
      fetch(`/api/saham/${k}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Detail | null) => setDetails((p) => ({ ...p, [k]: d })))
        .catch(() => setDetails((p) => ({ ...p, [k]: null })));
    }
  }, [kodes, details]);

  useEffect(() => {
    const q = kode.trim();
    if (!q || picked === q.toUpperCase()) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/saham?q=${encodeURIComponent(q)}&page=1&sort=mcap&dir=desc`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: ListResponse | null) => j && setSaran(j.items.slice(0, 6).map((i) => ({ kode: i.kode, nama: i.nama }))))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [kode, picked]);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    const k = (picked ?? kode).trim().toUpperCase();
    const h = Number(harga.replace(/[^\d.]/g, ""));
    const l = Number(lot.replace(/[^\d.]/g, ""));
    if (!/^[A-Z0-9]{4}$/.test(k)) return setErr("Pilih kode saham yang valid (4 karakter).");
    if (!(h > 0)) return setErr("Harga rata-rata beli harus lebih dari 0.");
    if (!(l > 0)) return setErr("Jumlah lot harus lebih dari 0.");
    setErr("");
    try {
      await onAdd({ kode: k, harga_beli: h, lot: l });
    } catch (e2) {
      return setErr(e2 instanceof Error ? e2.message : "Gagal menyimpan");
    }
    setKode("");
    setPicked(null);
    setSaran([]);
    setHarga("");
    setLot("");
  }

  async function submitTx(e: React.FormEvent) {
    e.preventDefault();
    const k = txKode.trim().toUpperCase();
    const h = Number(txHarga.replace(/[^\d.]/g, ""));
    const l = Number(txLot.replace(/[^\d.]/g, ""));
    const fee = Number(txFee.replace(/[^\d.]/g, "")) || 0;
    if (!/^[A-Z0-9]{4}$/.test(k)) return setTxErr("Pilih kode saham yang valid (4 karakter).");
    if (!(h > 0)) return setTxErr("Harga transaksi harus lebih dari 0.");
    if (!(l > 0)) return setTxErr("Jumlah lot harus lebih dari 0.");
    setTxErr("");
    try {
      await onAddTx({
        kode: k,
        tipe: txTipe,
        harga: h,
        lot: l,
        fee,
        tanggal: txTanggal,
        catatan: txCatatan,
      });
      setTxKode("");
      setTxHarga("");
      setTxLot("");
      setTxCatatan("");
    } catch (e2) {
      setTxErr(e2 instanceof Error ? e2.message : "Gagal menyimpan");
    }
  }

  const rows: Row[] = items.map((h) => {
    const d = details[h.kode] ?? undefined;
    const lembar = h.lot * LOT;
    const modal = lembar * h.harga_beli;
    const nilai = d?.harga != null ? lembar * d.harga : null;
    const pl = nilai === null ? null : nilai - modal;
    const divTahun = d?.dps_12m != null ? lembar * d.dps_12m : null;
    const nilaiTarget = d?.target_rata != null ? lembar * d.target_rata : null;
    return {
      ...h,
      d,
      modal,
      nilai,
      pl,
      plPct: pl === null ? null : (pl / modal) * 100,
      divTahun,
      yoc: d?.dps_12m != null ? (d.dps_12m / h.harga_beli) * 100 : null,
      nilaiTarget,
      potensiPct: nilaiTarget === null ? null : ((nilaiTarget - modal) / modal) * 100,
    };
  });

  const totalModal = rows.reduce((s, r) => s + r.modal, 0);
  const totalNilai = rows.reduce((s, r) => s + (r.nilai ?? r.modal), 0);
  const totalPl = totalNilai - totalModal;
  const totalPlPct = totalModal > 0 ? (totalPl / totalModal) * 100 : 0;
  const totalDiv = rows.reduce((s, r) => s + (r.divTahun ?? 0), 0);
  const totalDivNet = totalDiv * 0.9; // Setelah PPh Final 10%
  const g = Number(growth) || 0;
  const gd = Number(divGrowth) || 0;

  // Sektor Allocation calculation
  const sectorAllocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const s = r.d?.sektor || "Lainnya";
      const val = r.nilai ?? r.modal;
      map.set(s, (map.get(s) ?? 0) + val);
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    return [...map.entries()]
      .map(([nama, nilai], idx) => ({
        nama,
        nilai,
        pct: total > 0 ? (nilai / total) * 100 : 0,
        color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
      }))
      .sort((a, b) => b.nilai - a.nilai);
  }, [rows]);

  // Alpha vs IHSG calculation
  const ihsgPct = ihsg?.perubahan_pct ?? 0;
  const alphaPct = totalPlPct - ihsgPct;

  // Proyeksi pertumbuhan
  const proyeksi = [1, 3, 5, 10, 20].map((n) => {
    const nilai = totalNilai * Math.pow(1 + g / 100, n);
    let div = 0;
    for (let i = 0; i < n; i++) div += totalDivNet * Math.pow(1 + gd / 100, i);
    return { n, nilai, div, total: nilai + div, ret: totalModal ? ((nilai + div - totalModal) / totalModal) * 100 : 0 };
  });

  // Export CSV functions
  function exportHoldingsCSV() {
    const headers = [
      "Kode",
      "Nama Saham",
      "Sektor",
      "Lot",
      "Lembar",
      "Harga Beli",
      "Harga Terkini",
      "Total Modal",
      "Nilai Pasar",
      "Untung Rugi (Rp)",
      "Untung Rugi (%)",
      "DPS 12M",
      "Dividen Tahunan Bruto",
      "Yield on Cost (%)",
      "Target Analis",
    ];
    const dataRows = rows.map((r) => [
      r.kode,
      r.d?.nama || r.kode,
      r.d?.sektor || "-",
      r.lot,
      r.lot * LOT,
      r.harga_beli,
      r.d?.harga || "-",
      r.modal,
      r.nilai || r.modal,
      r.pl || 0,
      r.plPct ? num(r.plPct, 2) : 0,
      r.d?.dps_12m || 0,
      r.divTahun || 0,
      r.yoc ? num(r.yoc, 2) : 0,
      r.d?.target_rata || "-",
    ]);
    downloadCSV("portofolio_saham_ihsg.csv", headers, dataRows);
  }

  function exportTransactionsCSV() {
    const headers = ["Tanggal", "Tipe", "Kode", "Lot", "Harga", "Fee", "Total Nilai", "Catatan"];
    const dataRows = transactions.map((t) => [
      t.tanggal,
      t.tipe,
      t.kode,
      t.lot,
      t.harga,
      t.fee,
      t.harga * t.lot * LOT + (t.tipe === "BELI" ? t.fee : -t.fee),
      t.catatan || "-",
    ]);
    downloadCSV("riwayat_transaksi_ihsg.csv", headers, dataRows);
  }

  const input =
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100";

  return (
    <main className="screen-shell space-y-8 screen-section">
      {/* Page Header */}
      <div className="crystal-intro flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="crystal-title">Portofolio Saham</h1>
            <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Sinkronisasi Cloud
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Kelola alokasi sektor, bandingkan kinerja dengan IHSG, pantau dividen &amp; riwayat transaksi beli/jual.
          </p>
        </div>

        {/* Tab Switcher & Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-1 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => setTab("ringkasan")}
              className={`rounded-lg px-3.5 py-1.5 font-semibold transition ${
                tab === "ringkasan"
                  ? "bg-white text-green-700 shadow-sm dark:bg-zinc-800 dark:text-green-400"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Ringkasan &amp; Alokasi
            </button>
            <button
              onClick={() => setTab("saham")}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                tab === "saham"
                  ? "bg-white text-green-700 shadow-sm dark:bg-zinc-800 dark:text-green-400"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Saham ({items.length})
            </button>
            <button
              onClick={() => setTab("transaksi")}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                tab === "transaksi"
                  ? "bg-white text-green-700 shadow-sm dark:bg-zinc-800 dark:text-green-400"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Riwayat Transaksi ({transactions.length})
            </button>
          </div>

          <button
            onClick={tab === "transaksi" ? exportTransactionsCSV : exportHoldingsCSV}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <span>📥</span> Ekspor CSV
          </button>
        </div>
      </div>

      {legacyCount > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-green-50/60 dark:bg-zinc-800/60">
          <p className="text-sm text-green-900 dark:text-zinc-200">
            Ditemukan {legacyCount} saham dari portofolio lama di browser ini. Impor ke akun Anda?
          </p>
          <div className="flex gap-2">
            <button onClick={onImport} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              Impor
            </button>
            <button onClick={onDismissLegacy} className="rounded-xl border border-green-200 px-4 py-2 text-sm text-green-900 hover:bg-green-50 dark:border-zinc-700 dark:text-zinc-300">
              Abaikan
            </button>
          </div>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Summary label="Total Modal" value={compact(totalModal)} sub={`${rows.length} posisi saham`} />
        <Summary
          label="Nilai Pasar Sekarang"
          value={compact(totalNilai)}
          sub={totalPl >= 0 ? `+${compact(totalPl)} (${num(totalPlPct, 2)}%)` : `${compact(totalPl)} (${num(totalPlPct, 2)}%)`}
          cls={tone(totalPl)}
        />
        <Summary
          label="Dividen Bersih (Net PPh 10%)"
          value={compact(totalDivNet)}
          sub={`Rp ${compact(totalDivNet / 12)} / bulan`}
          cls="text-emerald-600 dark:text-emerald-400"
        />
        <Summary
          label="Yield on Cost Portofolio"
          value={totalModal > 0 ? pct((totalDiv / totalModal) * 100) : "0%"}
          sub="Dividen bruto vs modal awal"
        />
        {/* IHSG Benchmark Comparison KPI Card */}
        <Card className="p-5 sm:p-6 border-emerald-200 bg-emerald-50/30 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">vs Benchmark IHSG</div>
          <div className={`mt-2 text-2xl font-bold tabular-nums ${tone(alphaPct)}`}>
            {alphaPct >= 0 ? `+${num(alphaPct, 2)}%` : `${num(alphaPct, 2)}%`}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {alphaPct >= 0 ? "🟢 Mengalahkan IHSG (Alpha +)" : "🔴 Di bawah IHSG"}
          </div>
        </Card>
      </div>

      {/* TAB 1: Ringkasan & Alokasi */}
      {tab === "ringkasan" && (
        <div className="space-y-6">
          {/* Sector Allocation & Benchmark Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sector Pie/Donut Chart */}
            <Card>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">Alokasi per Sektor</h2>
              <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
                Diversifikasi portofolio untuk mengendalikan konsentrasi risiko sektoral.
              </p>

              {sectorAllocation.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-400">Belum ada saham dalam portofolio</div>
              ) : (
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                  {/* SVG Donut */}
                  <div className="relative h-44 w-44 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      {(() => {
                        let cumulativePct = 0;
                        return sectorAllocation.map((s) => {
                          const startAngle = (cumulativePct / 100) * 360;
                          cumulativePct += s.pct;
                          const endAngle = (cumulativePct / 100) * 360;

                          const x1 = 50 + 40 * Math.cos((Math.PI * startAngle) / 180);
                          const y1 = 50 + 40 * Math.sin((Math.PI * startAngle) / 180);
                          const x2 = 50 + 40 * Math.cos((Math.PI * endAngle) / 180);
                          const y2 = 50 + 40 * Math.sin((Math.PI * endAngle) / 180);

                          const largeArc = s.pct > 50 ? 1 : 0;
                          const d = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

                          return <path key={s.nama} d={d} fill={s.color} className="transition-all hover:opacity-80" />;
                        });
                      })()}
                      {/* Inner circle cutout for donut */}
                      <circle cx="50" cy="50" r="24" className="fill-white dark:fill-zinc-900" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[11px] text-zinc-400">Total</span>
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{compact(totalNilai)}</span>
                    </div>
                  </div>

                  {/* Legend list */}
                  <div className="flex-1 space-y-2 w-full">
                    {sectorAllocation.map((s) => (
                      <div key={s.nama} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">{s.nama}</span>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">{num(s.pct, 1)}%</span>
                          <span className="ml-2 text-zinc-400">({compact(s.nilai)})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Benchmark vs IHSG Card */}
            <Card className="flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">Perbandingan Kinerja vs IHSG</h2>
                <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
                  Mengukur kemampuan portofolio menghasilkan Alpha di atas indeks pasar IHSG (^JKSE).
                </p>

                <div className="space-y-4">
                  <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">Return Portofolio Anda</span>
                      <span className={`font-bold tabular-nums ${tone(totalPlPct)}`}>
                        {totalPlPct >= 0 ? "+" : ""}{num(totalPlPct, 2)}%
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        style={{ width: `${Math.min(100, Math.max(5, (totalPlPct + 50)))}%` }}
                        className={`h-full rounded-full ${totalPlPct >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">Pergerakan Indeks IHSG</span>
                      <span className={`font-bold tabular-nums ${tone(ihsgPct)}`}>
                        {ihsgPct >= 0 ? "+" : ""}{num(ihsgPct, 2)}%
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        style={{ width: `${Math.min(100, Math.max(5, (ihsgPct + 50)))}%` }}
                        className={`h-full rounded-full ${ihsgPct >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
                {alphaPct >= 0 ? (
                  <span>
                    🏆 Portofolio Anda mencatat <strong>Alpha +{num(alphaPct, 2)}%</strong> di atas pasar, membuktikan
                    strategi pemilihan saham berkinerja unggul!
                  </span>
                ) : (
                  <span>
                    ℹ️ Portofolio saat ini tertinggal <strong>{num(Math.abs(alphaPct), 2)}%</strong> dari IHSG. Evaluasi
                    kembali bobot saham berkinerja rendah.
                  </span>
                )}
              </div>
            </Card>
          </div>

          {/* Historical Simulation Chart */}
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">
                  Grafik Nilai Portofolio dari Waktu ke Waktu
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Proyeksi akumulasi modal dan apresiasi nilai investasi portofolio Anda.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Total Nilai Portofolio
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Modal Pokok
                </span>
              </div>
            </div>

            <LineChart
              series={[
                { values: proyeksi.map((p) => totalModal), stroke: "stroke-zinc-400 dark:stroke-zinc-600", dashed: true },
                { values: proyeksi.map((p) => p.total), stroke: "stroke-emerald-600", fill: "fill-emerald-500/10" },
              ]}
              xLabels={["Sekarang", "20 Tahun"]}
              formatY={compact}
            />
          </Card>
        </div>
      )}

      {/* TAB 2: Kepemilikan Saham */}
      {tab === "saham" && (
        <div className="space-y-6">
          {/* Add Stock Form */}
          <Card>
            <h2 className="mb-3 text-lg font-bold text-zinc-950 dark:text-zinc-100">Tambah Saham ke Portofolio</h2>
            <form onSubmit={tambah} className="grid gap-3 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
              <label className="relative block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Kode Saham
                <input
                  className={`${input} mt-1`}
                  value={kode}
                  onChange={(e) => {
                    setKode(e.target.value.toUpperCase());
                    setPicked(null);
                  }}
                  placeholder="Contoh: BBCA"
                />
                {saran.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                    {saran.map((s) => (
                      <button
                        key={s.kode}
                        type="button"
                        onClick={() => {
                          setPicked(s.kode);
                          setKode(s.kode);
                          setSaran([]);
                        }}
                        className="flex w-full items-baseline justify-between px-3 py-2 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <strong className="text-green-700 dark:text-green-400">{s.kode}</strong>
                        <span className="truncate text-zinc-400 max-w-[140px]">{s.nama}</span>
                      </button>
                    ))}
                  </div>
                )}
              </label>

              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Harga Rata-Rata Beli (Rp)
                <input
                  className={`${input} mt-1`}
                  value={harga}
                  onChange={(e) => setHarga(e.target.value)}
                  placeholder="Contoh: 9000"
                />
              </label>

              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Jumlah Lot
                <input
                  className={`${input} mt-1`}
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  placeholder="Contoh: 10"
                />
              </label>

              <button
                type="submit"
                className="h-10 rounded-xl bg-green-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-green-700"
              >
                + Tambah
              </button>
            </form>
            {err && <p className="mt-2 text-xs font-semibold text-rose-600">{err}</p>}
          </Card>

          {/* Holdings Table */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="font-bold text-zinc-950 dark:text-zinc-100">Daftar Kepemilikan Saham</h2>
              <button
                onClick={exportHoldingsCSV}
                className="text-xs font-semibold text-green-700 hover:underline dark:text-green-400"
              >
                Unduh CSV
              </button>
            </div>

            {rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-400">Belum ada saham yang ditambahkan.</div>
            ) : (
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-200/80 bg-zinc-50/80 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3.5 text-left">Kode</th>
                      <th className="px-4 py-3.5 text-right">Lot</th>
                      <th className="px-4 py-3.5 text-right">Harga Beli</th>
                      <th className="px-4 py-3.5 text-right">Harga Kini</th>
                      <th className="px-4 py-3.5 text-right">Total Modal</th>
                      <th className="px-4 py-3.5 text-right">Nilai Pasar</th>
                      <th className="px-4 py-3.5 text-right">Untung/Rugi</th>
                      <th className="px-4 py-3.5 text-right">Dividen Net/Thn</th>
                      <th className="px-4 py-3.5 text-right">Yield on Cost</th>
                      <th className="px-4 py-3.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {rows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <StockLogo kode={r.kode} size="sm" website={r.d?.website} />
                            <div>
                              <Link href={`/saham/${r.kode}`} className="font-bold text-green-700 hover:underline dark:text-green-400 text-sm">
                                {r.kode}
                              </Link>
                              <div className="text-xs text-zinc-400 truncate max-w-[130px]">{r.d?.nama || r.kode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-medium text-zinc-800 dark:text-zinc-200">{r.lot}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">{rp(r.harga_beli)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">{rp(r.d?.harga)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{compact(r.modal)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-bold text-zinc-900 dark:text-zinc-100">{compact(r.nilai)}</td>
                        <td className={`px-4 py-3.5 text-right tabular-nums font-bold ${tone(r.pl)}`}>
                          {r.pl === null ? "-" : `${sign(r.pl)}${compact(Math.abs(r.pl))} (${num(r.plPct, 1)}%)`}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                          {r.divTahun ? compact(r.divTahun * 0.9) : "-"}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{pct(r.yoc)}</td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {!r.transactionId && <button
                              onClick={() => openEdit(r)}
                              className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                              title="Edit harga beli atau jumlah lot"
                            >
                              Edit
                            </button>}
                            <button
                              onClick={() => {
                                setTab("transaksi");
                                setTxTipe("JUAL");
                                setTxKode(r.kode);
                                setTxHarga(r.d?.harga ? String(r.d.harga) : String(r.harga_beli));
                                setTxLot(String(r.lot));
                              }}
                              className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                            >
                              Jual
                            </button>
                            {!r.transactionId && <button
                              onClick={() => {
                                setPositionError("");
                                onRemove(r.id).catch((error: Error) => setPositionError(error.message));
                              }}
                              className="p-1 text-xs text-zinc-400 hover:text-rose-600"
                              title="Hapus posisi awal"
                              aria-label={"Hapus posisi awal " + r.kode}
                            >
                              ✕
                            </button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {positionError && <p role="alert" className="text-sm font-semibold text-rose-700 dark:text-rose-300">{positionError}</p>}

          {/* Modal Edit Posisi Saham */}
          {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
              <div className="ios-glass-canvas viewport-dialog relative w-full max-w-md space-y-4 rounded-3xl p-4 shadow-2xl sm:p-6">
                <div className="flex items-center justify-between border-b border-zinc-200/70 pb-3.5 dark:border-white/10">
                  <div>
                    <h3 className="text-base font-black text-[#191919] dark:text-white">
                      Edit Posisi Saham {editing.kode}
                    </h3>
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      Perbarui harga rata-rata beli atau jumlah lot Anda.
                    </p>
                  </div>
                  <button
                    onClick={() => setEditing(null)}
                    className="rounded-full h-8 w-8 flex items-center justify-center border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-xs font-bold text-xs shrink-0 transition"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={simpanEdit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Harga Rata-Rata Beli (Rp)
                    </label>
                    <input
                      className={`${input} mt-1`}
                      value={editHarga}
                      onChange={(e) => setEditHarga(e.target.value)}
                      placeholder="Contoh: 9000"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Jumlah Lot
                    </label>
                    <input
                      className={`${input} mt-1`}
                      value={editLot}
                      onChange={(e) => setEditLot(e.target.value)}
                      placeholder="Contoh: 10"
                    />
                  </div>

                  {editErr && (
                    <p className="text-xs font-bold text-rose-600">{editErr}</p>
                  )}

                  <div className="ios-glass-subtle rounded-2xl p-3 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/10">
                    Total Modal Baru:{" "}
                    <strong className="text-[#191919] dark:text-white font-black">
                      {rp(
                        (Number(editHarga.replace(/[^\d.]/g, "")) || 0) *
                          (Number(editLot.replace(/[^\d.]/g, "")) || 0) *
                          LOT
                      )}
                    </strong>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200/70 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded-full border border-zinc-200/80 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 transition"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="rounded-full bg-[#191919] text-white hover:bg-black dark:bg-white dark:text-[#191919] px-5 py-2 text-xs font-black shadow-md hover:scale-[1.01] active:scale-95 transition"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Riwayat Transaksi */}
      {tab === "transaksi" && (
        <div className="space-y-6">
          {/* Add Transaction Form */}
          <Card>
            <h2 className="mb-3 text-lg font-bold text-zinc-950 dark:text-zinc-100">Catat Transaksi Beli / Jual</h2>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">Beli menambah posisi. Jual mengurangi lot tertua lebih dulu. Kelola posisi yang dibeli melalui riwayat transaksi.</p>
            <form onSubmit={submitTx} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Tipe Transaksi
                <select
                  value={txTipe}
                  onChange={(e) => setTxTipe(e.target.value as "BELI" | "JUAL")}
                  className={`${input} mt-1 font-semibold ${
                    txTipe === "BELI" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  <option value="BELI">🟢 BELI (Buy)</option>
                  <option value="JUAL">🔴 JUAL (Sell)</option>
                </select>
              </label>

              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Kode Saham
                <input
                  type="text"
                  placeholder="BBCA"
                  value={txKode}
                  maxLength={4}
                  onChange={(e) => setTxKode(e.target.value.toUpperCase())}
                  className={`${input} mt-1`}
                />
              </label>

              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Tanggal
                <input
                  type="date"
                  value={txTanggal}
                  onChange={(e) => setTxTanggal(e.target.value)}
                  className={`${input} mt-1`}
                />
              </label>

              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Harga / Lembar (Rp)
                <input
                  type="text"
                  placeholder="9000"
                  value={txHarga}
                  onChange={(e) => setTxHarga(e.target.value)}
                  className={`${input} mt-1`}
                />
              </label>

              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Jumlah Lot
                <input
                  type="text"
                  placeholder="10"
                  value={txLot}
                  onChange={(e) => setTxLot(e.target.value)}
                  className={`${input} mt-1`}
                />
              </label>

              <button
                type="submit"
                className="h-10 rounded-xl bg-green-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-green-700"
              >
                + Simpan Transaksi
              </button>

              <label className="sm:col-span-2 lg:col-span-6 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Catatan (opsional)
                <input
                  type="text"
                  placeholder="Alasan transaksi beli/jual..."
                  value={txCatatan}
                  onChange={(e) => setTxCatatan(e.target.value)}
                  className={`${input} mt-1`}
                />
              </label>
            </form>
            {txErr && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{txErr}</p>}
          </Card>

          {/* Transactions History Table */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="font-bold text-zinc-950 dark:text-zinc-100">Riwayat Pembelian & Penjualan Saham</h2>
              <button
                onClick={exportTransactionsCSV}
                className="text-xs font-semibold text-green-700 hover:underline dark:text-green-400"
              >
                Unduh CSV Transaksi
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-400">Belum ada riwayat transaksi yang dicatat.</div>
            ) : (
              <div className="table-scroll">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300">
                    <tr>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-3 py-3">Tipe</th>
                      <th className="px-3 py-3">Kode</th>
                      <th className="px-3 py-3 text-right">Lot</th>
                      <th className="px-3 py-3 text-right">Harga</th>
                      <th className="px-3 py-3 text-right">Total Transaksi</th>
                      <th className="px-4 py-3">Catatan</th>
                      <th className="px-3 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {transactions.map((t) => {
                      const totalNominal = t.harga * t.lot * LOT;
                      return (
                        <tr key={t.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{t.tanggal}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                                t.tipe === "BELI"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                              }`}
                            >
                              {t.tipe}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-bold text-green-700 dark:text-green-400">{t.kode}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-zinc-800 dark:text-zinc-200">{t.lot}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-zinc-800 dark:text-zinc-200">{rp(t.harga)}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
                            {compact(totalNominal)}
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">{t.catatan || "-"}{!t.linked && <span className="block text-[10px]">Arsip lama</span>}</td>
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => {
                                setTxErr("");
                                onRemoveTx(t.id).catch((error: Error) => setTxErr(error.message));
                              }}
                              className="text-xs text-zinc-400 hover:text-rose-600"
                              title="Hapus transaksi"
                              aria-label={"Hapus transaksi " + t.tipe + " " + t.kode}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}

function Summary({ label, value, sub, cls = "text-zinc-950 dark:text-zinc-100" }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <Card className="p-5 sm:p-6 shadow-xs">
      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
      {sub && <div className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{sub}</div>}
    </Card>
  );
}
