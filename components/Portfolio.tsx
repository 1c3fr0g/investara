"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type Ref } from "react";
import { useSession } from "next-auth/react";
import type { CryptoItem, Detail, ListResponse } from "@/lib/types";
import { compact, num, pct, rp, signedPct } from "@/lib/format";
import { averageOpenBuyPrices, cryptoQuantityUnits, validPortfolioSymbol, type PortfolioMarket } from "@/lib/portfolio";
import { convertCryptoPrice, USD_TO_IDR, type CryptoPriceCurrency } from "@/lib/cryptoCurrency";
import { Card } from "./ui";
import { LoginButtons } from "./AuthButtons";
import { LineChart } from "./Charts";
import { StockLogo } from "./StockLogo";
import { CoinIcon } from "./CoinIcon";

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
const WIB_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" });
const cryptoPrice = (price: number | null | undefined) => price == null ? "-" : Math.abs(price) >= 1_000 ? rp(price)
  : `Rp ${price.toLocaleString("id-ID", { maximumFractionDigits: 8 })}`;
const cryptoValue = (value: number | null) => value !== null && Math.abs(value) < 1_000 ? cryptoPrice(value) : compact(value);
const coinQuantity = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 8 });
const usdtPrice = (value: number) => `${coinQuantity.format(value)} USDT`;
const usdtFromIdr = (value: number) => usdtPrice(convertCryptoPrice(value, "IDR", "USDT"));
const input = "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm transition dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100";

const tone = (v: number | null) => (v === null ? "" : v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400");
const sign = (v: number) => (v >= 0 ? "+" : "-");

type PositionQuote = Pick<Detail, "nama" | "harga" | "sektor" | "website" | "dps_12m" | "target_rata" | "quoteStale"> & {
  perubahan_pct?: number | null;
  change24h?: number | null;
  stale?: boolean;
};

type Row = Holding & {
  d?: PositionQuote;
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

export function Portfolio({ market = "stock" }: { market?: PortfolioMarket }) {
  const { status, data } = useSession();
  const crypto = market === "crypto";
  if (status === "loading")
    return <main className="screen-shell screen-section text-sm text-zinc-600 dark:text-zinc-400">Memuat portofolio...</main>;
  if (!data?.user)
    return (
      <main className="screen-shell space-y-6 screen-section">
        <h1 className="crystal-title">{crypto ? "Portofolio Kripto" : "Portofolio"}</h1>
        <Card>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Masuk untuk Menyimpan Portofolio</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {crypto ? "Simpan kepemilikan dan riwayat transaksi kripto ke akun Anda." : "Portofolio, alokasi sektor, dan riwayat transaksi beli/jual Anda tersimpan aman di database."}
          </p>
          <LoginButtons callbackUrl={crypto ? "/crypto/portofolio" : "/portofolio"} />
        </Card>
      </main>
    );
  return <PortfolioView key={market + ":" + data.user.id} market={market} />;
}

function PortfolioView({ market }: { market: PortfolioMarket }) {
  const cryptoMarket = market === "crypto";
  const holdingsApi = cryptoMarket ? "/api/crypto/portofolio" : "/api/portofolio";
  const transactionsApi = cryptoMarket ? holdingsApi : "/api/portofolio/transaksi";
  const [items, setItems] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [legacy, setLegacy] = useState<Omit<Holding, "id">[]>([]);
  const pendingTrade = useRef<{ key: string; id: string } | null>(null);

  async function loadPortfolio(signal?: AbortSignal) {
    try {
      const read = async (path: string) => {
        const response = await fetch(path, { cache: "no-store", signal });
        if (!response.ok) throw new Error("Gagal memuat portofolio.");
        return response.json();
      };
      const [holdings, journal] = await Promise.all([read(holdingsApi), cryptoMarket ? null : read(transactionsApi)]);
      if (signal?.aborted) return;
      setItems(holdings.items);
      setTransactions(cryptoMarket ? holdings.transactions : journal.items);
      setLoadError("");
    } catch {
      if (!signal?.aborted) setLoadError("Gagal memuat portofolio.");
    } finally {
      if (!signal?.aborted) setReady(true);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadPortfolio(controller.signal);
    if (!cryptoMarket) {
      try {
        const old = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]");
        if (Array.isArray(old)) setLegacy(old);
      } catch {}
    }
    return () => controller.abort();
  }, []);

  async function tambahItem(h: Omit<Holding, "id">) {
    await tambahTransaksi({
      kode: h.kode,
      tipe: "BELI",
      harga: h.harga_beli,
      lot: h.lot,
      fee: 0,
      tanggal: WIB_DATE.format(new Date()),
      catatan: "Penambahan posisi portofolio",
    });
  }

  async function hapusItem(id: string) {
    const r = await fetch(`/api/portofolio?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.json()).error ?? "Gagal menghapus posisi");
    await loadPortfolio();
  }

  async function ubahItem(holding: Holding, harga_beli: number, lot: number) {
    const r = await fetch(holdingsApi, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: holding.id, harga_beli, lot, expected: { harga_beli: holding.harga_beli, lot: holding.lot } }),
    });
    const j = await r.json().catch(() => null);
    if (r.status === 409) await loadPortfolio();
    if (!r.ok || !j) throw new Error(j?.error ?? "Gagal mengubah posisi.");
    setItems(j.items);
    setTransactions(j.transactions);
  }

  async function tambahTransaksi(tx: Omit<Transaction, "id" | "created_at">) {
    const key = JSON.stringify(tx);
    if (pendingTrade.current?.key !== key) pendingTrade.current = { key, id: crypto.randomUUID() };
    const requestId = pendingTrade.current.id;
    const r = await fetch(transactionsApi, {
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
    const r = await fetch(`${transactionsApi}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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
      await loadPortfolio();
      localStorage.removeItem(LEGACY_KEY);
      setLegacy([]);
    }
  }

  if (loadError) return (
    <main className="screen-shell screen-section space-y-4">
      <h1 className="crystal-title">{cryptoMarket ? "Portofolio Kripto" : "Portofolio Saham"}</h1>
      <Card>
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{loadError}</p>
        <button type="button" onClick={() => void loadPortfolio()} className="control-button crystal-primary mt-3 rounded-xl text-xs font-bold">Coba lagi</button>
      </Card>
    </main>
  );
  if (!ready) return <main className="screen-shell screen-section text-sm"><p role="status">Memuat portofolio…</p></main>;

  return (
    <PortfolioBody
      market={market}
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
  market,
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
  market: PortfolioMarket;
  items: Holding[];
  transactions: Transaction[];
  ready: boolean;
  onAdd: (h: Omit<Holding, "id">) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onEdit: (holding: Holding, harga_beli: number, lot: number) => Promise<void>;
  onAddTx: (tx: Omit<Transaction, "id" | "created_at">) => Promise<void>;
  onRemoveTx: (id: string) => Promise<void>;
  legacyCount: number;
  onImport: () => void;
  onDismissLegacy: () => void;
}) {
  const cryptoMarket = market === "crypto";
  const assetLabel = cryptoMarket ? "Kripto" : "Saham";
  const quantityLabel = cryptoMarket ? "Jumlah Koin" : "Jumlah Lot";
  const multiplier = cryptoMarket ? 1 : LOT;
  const formatPrice = cryptoMarket ? cryptoPrice : rp;
  const formatValue = cryptoMarket ? cryptoValue : compact;
  const formatQuantity = (quantity: number) => cryptoMarket ? coinQuantity.format(quantity) : quantity;
  const validQuantity = (quantity: number) => cryptoMarket ? cryptoQuantityUnits(quantity) !== null : quantity > 0;
  const quantityError = cryptoMarket ? "Masukkan jumlah koin yang positif dengan maksimal 8 angka desimal." : "Jumlah lot harus lebih dari 0.";
  const [tab, setTab] = useState<"ringkasan" | "saham" | "transaksi">("ringkasan");
  const [details, setDetails] = useState<Record<string, PositionQuote | null>>({});
  const [ihsg, setIhsg] = useState<{ harga: number | null; perubahan_pct: number | null } | null>(null);

  // Form states
  const [kode, setKode] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [saran, setSaran] = useState<{ kode: string; nama: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);
  const stockInputId = useId();
  const suggestionsId = `${stockInputId}-saran`;
  const suggestionsVisible = showSuggestions && saran.length > 0;
  const [harga, setHarga] = useState("");
  const [buyCurrency, setBuyCurrency] = useState<CryptoPriceCurrency>("IDR");
  const [lot, setLot] = useState("");
  const [err, setErr] = useState("");
  const [savingTrade, setSavingTrade] = useState(false);
  const [positionError, setPositionError] = useState("");
  const [positionNotice, setPositionNotice] = useState("");

  // Edit holding states
  const [editing, setEditing] = useState<Holding | null>(null);
  const [editHarga, setEditHarga] = useState("");
  const [editCurrency, setEditCurrency] = useState<CryptoPriceCurrency>("IDR");
  const [editLot, setEditLot] = useState("");
  const [editErr, setEditErr] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const editDialog = useRef<HTMLDialogElement>(null);
  const editPriceInput = useRef<HTMLInputElement>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (editing && editDialog.current && !editDialog.current.open) {
      editDialog.current.showModal();
      editPriceInput.current?.focus();
    }
  }, [editing]);

  function openEdit(h: Holding, trigger: HTMLButtonElement) {
    editTrigger.current = trigger;
    setEditing(h);
    setEditCurrency("IDR");
    setEditHarga(String(h.harga_beli));
    setEditLot(String(h.lot));
    setEditErr("");
    setPositionNotice("");
  }

  function closeEdit() {
    editDialog.current?.close();
    setEditing(null);
    editTrigger.current?.focus({ preventScroll: true });
    editTrigger.current = null;
  }

  async function simpanEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || savingEdit) return;
    const h = convertCryptoPrice(Number(editHarga), editCurrency, "IDR");
    const l = Number(editLot);
    if (!(h > 0 && h <= (cryptoMarket ? 1e12 : 1e9))) return setEditErr("Harga beli di luar batas pencatatan.");
    if (!validQuantity(l) || l > 1e9) return setEditErr(quantityError);
    setEditErr("");
    setSavingEdit(true);
    try {
      await onEdit(editing, h, l);
      setPositionNotice(`Posisi ${editing.kode} diperbarui.`);
      closeEdit();
    } catch (err2) {
      setEditErr(err2 instanceof Error ? err2.message : "Gagal mengubah");
    } finally {
      setSavingEdit(false);
    }
  }

  function selectStock(suggestion: string) {
    setPicked(suggestion);
    setKode(suggestion);
    setSaran([]);
    setShowSuggestions(false);
    setHighlightedSuggestion(-1);
  }

  // Transaction form states
  const [txTipe, setTxTipe] = useState<"BELI" | "JUAL">("BELI");
  const [txKode, setTxKode] = useState("");
  const [txHarga, setTxHarga] = useState("");
  const [txCurrency, setTxCurrency] = useState<CryptoPriceCurrency>("IDR");
  const [txLot, setTxLot] = useState("");
  const [txTanggal, setTxTanggal] = useState("");

  useEffect(() => {
    setTxTanggal(new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }));
  }, []);
  const [txFee, setTxFee] = useState("0");
  const [txCatatan, setTxCatatan] = useState("");
  const [txErr, setTxErr] = useState("");

  const [growth, setGrowth] = useState(cryptoMarket ? "0" : "8");
  const [divGrowth, setDivGrowth] = useState("5");

  const kodes = useMemo(() => [...new Set(items.map((i) => i.kode))], [items]);
  const cryptoSymbols = [...new Set(["BTC", ...kodes])].sort().join(",");

  useEffect(() => {
    if (cryptoMarket) return;
    // Fetch IHSG benchmark
    fetch("/api/ihsg")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setIhsg({ harga: j.harga, perubahan_pct: j.perubahan_pct }))
      .catch(() => {});
  }, [cryptoMarket]);

  useEffect(() => {
    if (cryptoMarket) return;
    for (const k of kodes) {
      if (k in details) continue;
      fetch(`/api/saham/${k}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Detail | null) => setDetails((p) => ({ ...p, [k]: d })))
        .catch(() => setDetails((p) => ({ ...p, [k]: null })));
    }
  }, [kodes, details, cryptoMarket]);

  useEffect(() => {
    if (!cryptoMarket) return;
    const controller = new AbortController();
    const symbols = cryptoSymbols.split(",");
    let refreshing = false;
    async function loadQuotes() {
      if (refreshing) return;
      refreshing = true;
      const next: Record<string, PositionQuote | null> = {};
      const batches: string[][] = [];
      for (let i = 0; i < symbols.length; i += 100) batches.push(symbols.slice(i, i + 100));
      await Promise.all(batches.map(async (batch) => {
        try {
          const params = new URLSearchParams({ symbols: batch.join(","), size: "100" });
          const response = await fetch(`/api/crypto?${params}`, { signal: controller.signal });
          if (!response.ok) return;
          const { items }: { items: CryptoItem[] } = await response.json();
          for (const coin of items) {
            next[coin.symbol] = { nama: coin.name, harga: coin.price_idr, sektor: coin.category, website: null,
              dps_12m: null, target_rata: null, change24h: coin.change_24h, stale: coin.stale };
          }
        } catch { /* Mark existing prices as stale below when a request fails. */ }
      }));
      if (!controller.signal.aborted) {
        setDetails((previous) => Object.fromEntries(symbols.map((symbol) => {
          const old = previous[symbol];
          return [symbol, next[symbol] ?? (old ? { ...old, stale: true } : null)];
        })));
      }
      refreshing = false;
    }
    void loadQuotes();
    const interval = window.setInterval(() => { if (!document.hidden) void loadQuotes(); }, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [cryptoMarket, cryptoSymbols]);

  useEffect(() => {
    const q = kode.trim();
    if (!q || picked === q.toUpperCase()) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/${cryptoMarket ? "crypto" : "saham"}?q=${encodeURIComponent(q)}&page=1&sort=mcap&dir=desc`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: ListResponse | { items: CryptoItem[] } | null) => {
          if (j && !ctrl.signal.aborted) setSaran(j.items.slice(0, 6).map((i) =>
            "symbol" in i ? { kode: i.symbol, nama: i.name } : { kode: i.kode, nama: i.nama }));
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [kode, picked, cryptoMarket]);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (savingTrade || !ready) return;
    const k = (picked ?? kode).trim().toUpperCase();
    const h = cryptoMarket ? convertCryptoPrice(Number(harga), buyCurrency, "IDR") : Number(harga.replace(/[^\d.]/g, ""));
    const l = Number(cryptoMarket ? lot : lot.replace(/[^\d.]/g, ""));
    if (!validPortfolioSymbol(k, market)) return setErr(cryptoMarket ? "Pilih kode koin yang valid." : "Pilih kode saham yang valid (4 karakter).");
    if (!(h > 0) || (cryptoMarket && h > 1e12)) return setErr(cryptoMarket ? "Harga beli di luar batas pencatatan." : "Harga rata-rata beli harus lebih dari 0.");
    if (!validQuantity(l)) return setErr(quantityError);
    setErr("");
    setSavingTrade(true);
    try {
      await onAdd({ kode: k, harga_beli: h, lot: l });
    } catch (e2) {
      return setErr(e2 instanceof Error ? e2.message : "Gagal menyimpan");
    } finally {
      setSavingTrade(false);
    }
    setKode("");
    setPicked(null);
    setSaran([]);
    setShowSuggestions(false);
    setHighlightedSuggestion(-1);
    setHarga("");
    setLot("");
  }

  async function submitTx(e: React.FormEvent) {
    e.preventDefault();
    if (savingTrade || !ready) return;
    const k = txKode.trim().toUpperCase();
    const h = cryptoMarket ? convertCryptoPrice(Number(txHarga), txCurrency, "IDR") : Number(txHarga.replace(/[^\d.]/g, ""));
    const l = Number(cryptoMarket ? txLot : txLot.replace(/[^\d.]/g, ""));
    const fee = Number(cryptoMarket ? txFee : txFee.replace(/[^\d.]/g, "")) || 0;
    if (!validPortfolioSymbol(k, market)) return setTxErr(cryptoMarket ? "Pilih kode koin yang valid." : "Pilih kode saham yang valid (4 karakter).");
    if (!(h > 0) || (cryptoMarket && h > 1e12)) return setTxErr(cryptoMarket ? "Harga transaksi di luar batas pencatatan." : "Harga transaksi harus lebih dari 0.");
    if (!validQuantity(l)) return setTxErr(quantityError);
    setTxErr("");
    setSavingTrade(true);
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
      setTxFee("0");
      setTxCatatan("");
    } catch (e2) {
      setTxErr(e2 instanceof Error ? e2.message : "Gagal menyimpan");
    } finally {
      setSavingTrade(false);
    }
  }

  const tradesById = new Map(transactions.map((trade) => [trade.id, trade]));
  const editingBuy = cryptoMarket && editing?.transactionId ? tradesById.get(editing.transactionId) : undefined;
  const editedQuantity = Number(editLot) || 0;
  const editedTotalQuantity = editingBuy && editing ? editingBuy.lot - editing.lot + editedQuantity : 0;
  const editedFee = editingBuy && editedTotalQuantity > 0 ? editingBuy.fee * editedQuantity / editedTotalQuantity : 0;
  const editedCost = convertCryptoPrice(Number(editHarga) || 0, editCurrency, "IDR") * editedQuantity * multiplier + editedFee;
  const averageBuyPrices = useMemo(() => cryptoMarket ? averageOpenBuyPrices(items) : [], [cryptoMarket, items]);
  const rows: Row[] = items.map((h) => {
    const d = details[h.kode] ?? undefined;
    const lembar = h.lot * multiplier;
    const buy = cryptoMarket && h.transactionId ? tradesById.get(h.transactionId) : undefined;
    const modal = lembar * h.harga_beli + (buy ? buy.fee * h.lot / buy.lot : 0);
    const nilai = d?.harga != null && !d.stale && !d.quoteStale ? lembar * d.harga : null;
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
  const pricedRows = rows.filter((row) => row.nilai !== null).length;
  const completeQuotes = rows.length > 0 && pricedRows === rows.length;
  const totalNilai = rows.reduce((s, r) => s + (r.nilai ?? 0), 0);
  const totalPl = totalNilai - totalModal;
  const totalPlPct = totalModal > 0 ? (totalPl / totalModal) * 100 : 0;
  const totalDiv = rows.reduce((s, r) => s + (r.divTahun ?? 0), 0);
  const totalDivNet = totalDiv * 0.9; // Setelah PPh Final 10%
  const g = cryptoMarket ? Math.max(-100, Math.min(1000, Number(growth) || 0)) : Number(growth) || 0;
  const gd = cryptoMarket ? 0 : Number(divGrowth) || 0;

  // Sektor Allocation calculation
  const sectorAllocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.nilai === null) continue;
      const s = r.d?.sektor || "Lainnya";
      const val = r.nilai;
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
  const ihsgPct = ihsg?.perubahan_pct ?? null;
  const changes = rows.map((row) => cryptoMarket ? row.d?.change24h : row.d?.quoteStale ? null : row.d?.perubahan_pct);
  const previousValue = completeQuotes && changes.every((change) => change != null && Number.isFinite(change) && change > -100)
    ? rows.reduce((sum, row, index) => sum + row.nilai! / (1 + changes[index]! / 100), 0) : 0;
  const basketChange = previousValue > 0 ? (totalNilai / previousValue - 1) * 100 : null;
  const ihsgDifference = basketChange !== null && ihsgPct !== null ? basketChange - ihsgPct : null;
  const btc = details.BTC;
  const btc24h = btc && !btc.stale ? btc.change24h ?? null : null;
  const portfolio24h = cryptoMarket ? basketChange : null;
  const btcDifference = portfolio24h !== null && btc24h !== null ? portfolio24h - btc24h : null;

  // Proyeksi pertumbuhan
  const years = cryptoMarket ? Array.from({ length: 21 }, (_, year) => year) : [1, 3, 5, 10, 20];
  const proyeksi = years.map((n) => {
    const nilai = totalNilai * Math.pow(1 + g / 100, n);
    let div = 0;
    for (let i = 0; i < n; i++) div += totalDivNet * Math.pow(1 + gd / 100, i);
    return { n, nilai, div, total: nilai + div, ret: totalModal ? ((nilai + div - totalModal) / totalModal) * 100 : 0 };
  });

  // Export CSV functions
  function exportHoldingsCSV() {
    if (cryptoMarket) {
      downloadCSV("portofolio_kripto.csv", ["Kode", "Nama Koin", "Kategori", "Jumlah Koin", "Harga Beli (Rp)", "Harga Kini (Rp)", "Total Modal (Rp)", "Nilai Pasar (Rp)", "Untung/Rugi (Rp)", "Untung/Rugi (%)"],
        rows.map((r) => [r.kode, r.d?.nama ?? r.kode, r.d?.sektor, r.lot, r.harga_beli, r.d?.stale ? null : r.d?.harga, r.modal, r.nilai, r.pl, r.plPct]));
      return;
    }
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
    const headers = ["Tanggal", "Tipe", "Kode", cryptoMarket ? "Jumlah Koin" : "Lot", "Harga", "Fee", "Total Nilai", "Catatan"];
    const dataRows = transactions.map((t) => [
      t.tanggal,
      t.tipe,
      t.kode,
      t.lot,
      t.harga,
      t.fee,
      t.harga * t.lot * multiplier + (t.tipe === "BELI" ? t.fee : -t.fee),
      t.catatan || "-",
    ]);
    downloadCSV(cryptoMarket ? "riwayat_transaksi_kripto.csv" : "riwayat_transaksi_ihsg.csv", headers, dataRows);
  }

  return (
    <main className="screen-shell space-y-8 screen-section">
      {/* Page Header */}
      <div className="crystal-intro flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="crystal-title">Portofolio {assetLabel}</h1>
            <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Sinkronisasi Cloud
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {cryptoMarket ? "Pantau nilai koin, bandingkan pergerakan dengan BTC, dan catat transaksi beli atau jual." : "Kelola alokasi sektor, bandingkan kinerja dengan IHSG, pantau dividen & riwayat transaksi beli/jual."}
          </p>
        </div>

        {/* Tab Switcher & Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex flex-wrap rounded-xl border border-zinc-200 bg-zinc-50 p-1 text-xs dark:border-zinc-800 dark:bg-zinc-900">
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
              {assetLabel} ({items.length})
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
        <Summary label="Total Modal" value={formatValue(totalModal)} sub={`${rows.length} posisi ${assetLabel.toLowerCase()}`} />
        <Summary
          label="Nilai Pasar Sekarang"
          value={formatValue(completeQuotes ? totalNilai : null)}
          sub={!completeQuotes ? rows.length ? `${pricedRows} dari ${rows.length} posisi memiliki harga` : "Tambahkan kepemilikan" :
            `${totalPl >= 0 ? "+" : ""}${formatValue(totalPl)} (${num(totalPlPct, 2)}%)`}
          cls={tone(completeQuotes ? totalPl : null) || undefined}
        />
        {cryptoMarket ? <>
          <Summary label="Untung/Rugi Posisi" value={formatValue(completeQuotes ? totalPl : null)} sub={completeQuotes ? signedPct(totalPlPct) : ""} cls={tone(completeQuotes ? totalPl : null) || undefined} />
          <Summary label="Portofolio 24 Jam" value={signedPct(portfolio24h)} cls={tone(portfolio24h) || undefined} />
          <Summary label="Selisih vs BTC 24 Jam" value={btcDifference === null ? "-" : `${btcDifference >= 0 ? "+" : ""}${num(btcDifference)} poin %`} cls={tone(btcDifference) || undefined} />
        </> : <>
        <Summary
          label="Estimasi Dividen setelah Potongan"
          value={compact(totalDivNet)}
          sub={`${compact(totalDivNet / 12)} / bulan dengan asumsi potongan 10%`}
          cls="text-emerald-600 dark:text-emerald-400"
        />
        <Summary
          label="Yield on Cost Portofolio"
          value={totalModal > 0 ? pct((totalDiv / totalModal) * 100) : "0%"}
          sub="Dividen bruto vs modal awal"
        />
        {/* IHSG Benchmark Comparison KPI Card */}
        <Card className="p-5 sm:p-6 border-emerald-200 bg-emerald-50/30 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Selisih Harian vs IHSG</div>
          <div className={`mt-2 text-2xl font-bold tabular-nums ${tone(ihsgDifference)}`}>
            {ihsgDifference === null ? "-" : `${ihsgDifference >= 0 ? "+" : ""}${num(ihsgDifference)} poin %`}
          </div>
        </Card>
        </>}
      </div>

      {averageBuyPrices.length > 0 && tab !== "transaksi" && (
        <Card className="p-0">
          <div className="border-b border-zinc-200/75 px-4 py-3 dark:border-white/10 sm:px-5">
            <h2 id="crypto-average-buy" className="font-bold">Rata-rata Harga Beli</h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Rata-rata tertimbang dari pembelian yang masih dimiliki, di luar biaya transaksi. Estimasi USDT memakai kurs tetap {rp(USD_TO_IDR)} per USDT.
            </p>
          </div>
          <div role="region" aria-labelledby="crypto-average-buy" tabIndex={0} className="table-scroll">
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-600 dark:text-zinc-300">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left">Koin</th>
                  <th scope="col" className="px-4 py-2 text-right">Jumlah Tersisa</th>
                  <th scope="col" className="px-4 py-2 text-right">Rata-rata per Koin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/75 dark:divide-white/10">
                {averageBuyPrices.map(({ symbol, quantity, priceIdr }) => (
                  <tr key={symbol}>
                    <th scope="row" className="px-4 py-2.5 text-left font-bold">{symbol}</th>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatQuantity(quantity)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className="whitespace-nowrap font-semibold">{cryptoPrice(priceIdr)}</span>
                      <span className="block whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400">≈ {usdtFromIdr(priceIdr)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 1: Ringkasan & Alokasi */}
      {tab === "ringkasan" && (
        <div className="space-y-6">
          {/* Sector Allocation & Benchmark Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sector Pie/Donut Chart */}
            <Card>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">Alokasi per {cryptoMarket ? "Kategori" : "Sektor"}</h2>
              <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
                {cryptoMarket ? "Bobot kategori berdasarkan nilai pasar koin yang memiliki harga terkini." : "Diversifikasi portofolio untuk mengendalikan konsentrasi risiko sektoral."}
              </p>

              {sectorAllocation.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {cryptoMarket && rows.length ? "Harga pasar belum tersedia untuk menghitung alokasi." : `Belum ada ${assetLabel.toLowerCase()} dalam portofolio.`}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                  {/* SVG Donut */}
                  <div className="relative h-44 w-44 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      {(() => {
                        let cumulativePct = 0;
                        return sectorAllocation.map((s) => {
                          if (s.pct >= 100) return <circle key={s.nama} cx="50" cy="50" r="40" fill={s.color} />;
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
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{formatValue(completeQuotes ? totalNilai : null)}</span>
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
                          <span className="ml-2 text-zinc-400">({formatValue(s.nilai)})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Benchmark vs IHSG Card */}
            {cryptoMarket ? (
              <Card>
                <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">Perbandingan Kinerja vs BTC</h2>
                <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">Estimasi perubahan 24 jam berdasarkan jumlah koin yang dimiliki saat ini.</p>
                <dl className="space-y-2">
                  <div className="ios-glass-subtle flex justify-between gap-3 rounded-xl p-4 text-sm">
                    <dt>Portofolio 24 jam</dt><dd className={`font-bold tabular-nums ${tone(portfolio24h)}`}>{signedPct(portfolio24h)}</dd>
                  </div>
                  <div className="ios-glass-subtle flex justify-between gap-3 rounded-xl p-4 text-sm">
                    <dt>Bitcoin 24 jam</dt><dd className={`font-bold tabular-nums ${tone(btc24h)}`}>{signedPct(btc24h)}</dd>
                  </div>
                </dl>
              </Card>
            ) : <Card className="flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">Pergerakan Harian vs IHSG</h2>
                <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
                  Estimasi pergerakan harian dari jumlah saham yang dimiliki saat ini.
                </p>

                <dl className="space-y-2">
                  <div className="ios-glass-subtle flex justify-between gap-3 rounded-xl p-4 text-sm">
                    <dt>Portofolio hari ini</dt>
                    <dd className={`font-bold tabular-nums ${tone(basketChange)}`}>{signedPct(basketChange)}</dd>
                  </div>
                  <div className="ios-glass-subtle flex justify-between gap-3 rounded-xl p-4 text-sm">
                    <dt>IHSG hari ini</dt>
                    <dd className={`font-bold tabular-nums ${tone(ihsgPct)}`}>{signedPct(ihsgPct)}</dd>
                  </div>
                </dl>
              </div>
            </Card>}
          </div>

          {/* Historical Simulation Chart */}
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">
                  Proyeksi Nilai Portofolio
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {cryptoMarket ? "Simulasi pertumbuhan majemuk dari nilai pasar saat ini." : "Proyeksi akumulasi modal dan apresiasi nilai investasi portofolio Anda."}
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

            {cryptoMarket && completeQuotes && <label className="mb-4 block w-full max-w-xs text-xs font-semibold">
              Asumsi perubahan per tahun (%)
              <input type="number" min={-100} max={1000} value={growth} onChange={(e) => setGrowth(e.target.value)} className={`${input} mt-1`} />
            </label>}
            {completeQuotes ? <LineChart
              series={[
                { values: proyeksi.map((p) => totalModal), stroke: "stroke-zinc-400 dark:stroke-zinc-600", dashed: true },
                { values: proyeksi.map((p) => p.total), stroke: "stroke-emerald-600", fill: "fill-emerald-500/10" },
              ]}
              xLabels={[cryptoMarket ? "Sekarang" : "1 Tahun", "20 Tahun"]}
              formatY={formatValue}
            /> : <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Proyeksi muncul setelah harga terkini tersedia untuk semua posisi.</p>}
          </Card>
        </div>
      )}

      {/* TAB 2: Kepemilikan Saham */}
      {tab === "saham" && (
        <div className="space-y-6">
          {/* Add Stock Form */}
          <Card>
            <h2 className="mb-3 text-lg font-bold text-zinc-950 dark:text-zinc-100">Tambah {assetLabel} ke Portofolio</h2>
            <form onSubmit={tambah} className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
              <div className="min-w-0 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                <label htmlFor={stockInputId}>{cryptoMarket ? "Kode Koin" : "Kode Saham"}</label>
                <input
                  id={stockInputId}
                  className={`${input} mt-1`}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsVisible}
                  aria-controls={suggestionsVisible ? suggestionsId : undefined}
                  aria-activedescendant={suggestionsVisible && highlightedSuggestion >= 0 ? `${suggestionsId}-${highlightedSuggestion}` : undefined}
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={kode}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    setShowSuggestions(false);
                    setHighlightedSuggestion(-1);
                  }}
                  onChange={(e) => {
                    setKode(e.target.value.toUpperCase());
                    setPicked(null);
                    setSaran([]);
                    setHighlightedSuggestion(-1);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && showSuggestions) {
                      e.preventDefault();
                      setShowSuggestions(false);
                      setHighlightedSuggestion(-1);
                    } else if (saran.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                      e.preventDefault();
                      const step = e.key === "ArrowDown" ? 1 : -1;
                      const next = highlightedSuggestion < 0 ? (step === 1 ? 0 : saran.length - 1)
                        : (highlightedSuggestion + step + saran.length) % saran.length;
                      setShowSuggestions(true);
                      setHighlightedSuggestion(next);
                      document.getElementById(`${suggestionsId}-${next}`)?.scrollIntoView({ block: "nearest" });
                    } else if (e.key === "Enter" && suggestionsVisible && saran[highlightedSuggestion]) {
                      e.preventDefault();
                      selectStock(saran[highlightedSuggestion].kode);
                    }
                  }}
                  placeholder={cryptoMarket ? "Contoh: BTC" : "Contoh: BBCA"}
                />
                {suggestionsVisible && (
                  <div id={suggestionsId} role="listbox" aria-label="Saran kode saham" className="ios-glass-subtle mt-2 max-h-48 overflow-y-auto rounded-xl p-1">
                    {saran.map((s, index) => (
                      <button
                        key={s.kode}
                        id={`${suggestionsId}-${index}`}
                        type="button"
                        role="option"
                        aria-selected={highlightedSuggestion === index}
                        tabIndex={-1}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectStock(s.kode)}
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-white/75 aria-selected:bg-white dark:hover:bg-white/10 dark:aria-selected:bg-white/15"
                      >
                        <strong className="shrink-0 text-green-700 dark:text-green-400">{s.kode}</strong>
                        <span title={s.nama} className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">{s.nama}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {cryptoMarket ? (
                <CryptoUnitPriceInput label="Harga Beli per Koin" value={harga} currency={buyCurrency}
                  onChange={setHarga} onCurrencyChange={setBuyCurrency} disabled={savingTrade} />
              ) : <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Harga Rata-Rata Beli (Rp)
                <input
                  className={`${input} mt-1`}
                  value={harga}
                  onChange={(e) => setHarga(e.target.value)}
                  placeholder="Contoh: 9000"
                />
              </label>}

              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {quantityLabel}
                <input
                  type={cryptoMarket ? "number" : "text"}
                  step={cryptoMarket ? "any" : undefined}
                  inputMode={cryptoMarket ? "decimal" : undefined}
                  className={`${input} mt-1`}
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  placeholder={cryptoMarket ? "Contoh: 0.05" : "Contoh: 10"}
                />
              </label>

              <button
                type="submit"
                disabled={savingTrade || !ready}
                className="h-10 rounded-xl bg-green-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-60 sm:mt-6"
              >
                {savingTrade ? "Menyimpan…" : "+ Tambah"}
              </button>
            </form>
            {err && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{err}</p>}
          </Card>

          {/* Holdings Table */}
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="font-bold text-zinc-950 dark:text-zinc-100">Daftar Kepemilikan {assetLabel}</h2>
              <button
                onClick={exportHoldingsCSV}
                className="text-xs font-semibold text-green-700 hover:underline dark:text-green-400"
              >
                Unduh CSV
              </button>
            </div>

            {rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">{!ready ? "Memuat kepemilikan…" : `Belum ada ${assetLabel.toLowerCase()} yang ditambahkan.`}</div>
            ) : (
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-200/80 bg-zinc-50/80 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3.5 text-left">Kode</th>
                      <th className="px-4 py-3.5 text-right">{cryptoMarket ? "Jumlah Koin" : "Lot"}</th>
                      <th className="px-4 py-3.5 text-right">Harga Beli</th>
                      <th className="px-4 py-3.5 text-right">Harga Kini</th>
                      <th className="px-4 py-3.5 text-right">Total Modal</th>
                      <th className="px-4 py-3.5 text-right">Nilai Pasar</th>
                      <th className="px-4 py-3.5 text-right">Untung/Rugi</th>
                      {!cryptoMarket && <>
                        <th className="px-4 py-3.5 text-right">Dividen Net/Thn</th>
                        <th className="px-4 py-3.5 text-right">Yield on Cost</th>
                      </>}
                      <th className="px-4 py-3.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {rows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            {cryptoMarket ? <CoinIcon symbol={r.kode} name={r.d?.nama ?? r.kode} size={24} className="size-6 shrink-0" /> :
                              <StockLogo kode={r.kode} size="sm" website={r.d?.website} />}
                            <div className="min-w-0">
                              <Link href={cryptoMarket ? `/crypto/${r.kode.toLowerCase()}` : `/saham/${r.kode}`} className="font-bold text-green-700 hover:underline dark:text-green-400 text-sm">
                                {r.kode}
                              </Link>
                              <div className="text-xs text-zinc-400 truncate max-w-[130px]">{r.d?.nama || r.kode}</div>
                              <button
                                type="button"
                                onClick={(event) => openEdit(r, event.currentTarget)}
                                className="ios-glass-subtle mt-1 inline-flex min-h-11 items-center rounded-lg px-2.5 text-xs font-semibold text-zinc-700 hover:bg-white sm:min-h-8 dark:text-zinc-200 dark:hover:bg-white/15"
                                aria-label={`Edit posisi ${r.kode}`}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-medium text-zinc-800 dark:text-zinc-200">{formatQuantity(r.lot)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                          {formatPrice(r.harga_beli)}
                          {cryptoMarket && <span className="block whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400">≈ {usdtFromIdr(r.harga_beli)}</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatPrice(r.d?.harga)}
                          {r.d?.stale && <span className="block text-xs font-normal text-amber-700 dark:text-amber-300">Harga tersimpan</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatValue(r.modal)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-bold text-zinc-900 dark:text-zinc-100">{formatValue(r.nilai)}</td>
                        <td className={`px-4 py-3.5 text-right tabular-nums font-bold ${tone(r.pl)}`}>
                          {r.pl === null ? "-" : `${sign(r.pl)}${formatValue(Math.abs(r.pl))} (${num(r.plPct, 1)}%)`}
                        </td>
                        {!cryptoMarket && <>
                          <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                            {r.divTahun ? compact(r.divTahun * 0.9) : "-"}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{pct(r.yoc)}</td>
                        </>}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setTab("transaksi");
                                setTxTipe("JUAL");
                                setTxKode(r.kode);
                                setTxCurrency("IDR");
                                setTxHarga(r.d?.harga && !r.d.stale ? String(r.d.harga) : cryptoMarket ? "" : String(r.harga_beli));
                                setTxLot(String(r.lot));
                                setTxFee("0");
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
          {positionNotice && <p role="status" className="text-sm font-semibold text-green-700 dark:text-green-300">{positionNotice}</p>}

          {/* Modal Edit Posisi Saham */}
          {editing && (
            <dialog
              ref={editDialog}
              aria-labelledby="edit-position-title"
              aria-describedby="edit-position-description"
              onCancel={(event) => {
                event.preventDefault();
                if (!savingEdit) closeEdit();
              }}
              className="ios-glass-canvas viewport-dialog fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md space-y-4 rounded-3xl p-4 text-zinc-950 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm dark:text-zinc-100 sm:p-6"
            >
              <div className="flex items-center justify-between border-b border-zinc-200/70 pb-3.5 dark:border-white/10">
                <div>
                  <h3 id="edit-position-title" className="text-base font-black text-[#191919] dark:text-white">
                    Edit Posisi {assetLabel} {editing.kode}
                  </h3>
                  <p id="edit-position-description" className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    {editing.transactionId ? "Perubahan ini juga memperbarui transaksi beli terkait." : "Perbarui harga beli dan lot yang masih dimiliki."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={savingEdit}
                  aria-label="Tutup edit posisi"
                  className="rounded-full h-8 w-8 flex items-center justify-center border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-xs font-bold text-xs shrink-0 transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={simpanEdit} className="space-y-4">
                {cryptoMarket ? (
                  <CryptoUnitPriceInput label="Harga Beli per Koin" value={editHarga} currency={editCurrency}
                    onChange={setEditHarga} onCurrencyChange={setEditCurrency} disabled={savingEdit} inputRef={editPriceInput} />
                ) : <div>
                  <label htmlFor="edit-position-price" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Harga Rata-Rata Beli (Rp)
                  </label>
                  <input
                    id="edit-position-price"
                    ref={editPriceInput}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    required
                    readOnly={savingEdit}
                    className={`${input} mt-1`}
                    value={editHarga}
                    onChange={(e) => setEditHarga(e.target.value)}
                    placeholder="Contoh: 9000"
                  />
                </div>}

                <div>
                  <label htmlFor="edit-position-lot" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {cryptoMarket ? "Jumlah Koin Tersisa" : "Lot Tersisa"}
                  </label>
                  <input
                    id="edit-position-lot"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    required
                    readOnly={savingEdit}
                    className={`${input} mt-1`}
                    value={editLot}
                    onChange={(e) => setEditLot(e.target.value)}
                    placeholder={cryptoMarket ? "Contoh: 0.05" : "Contoh: 10"}
                  />
                </div>

                {editErr && (
                  <p role="alert" className="text-xs font-bold text-rose-700 dark:text-rose-300">{editErr}</p>
                )}

                <div className="ios-glass-subtle rounded-2xl p-3 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/10">
                  Modal posisi tersisa{" "}
                  <strong className="text-[#191919] dark:text-white font-black">
                    {formatValue(editedCost)}
                  </strong>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200/70 pt-2 dark:border-white/10">
                  <button
                    type="button"
                    onClick={closeEdit}
                    disabled={savingEdit}
                    className="control-button min-h-11 rounded-full border border-zinc-200/80 bg-white text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="control-button crystal-primary min-h-11 rounded-full text-xs font-bold transition disabled:opacity-60"
                  >
                    {savingEdit ? "Menyimpan…" : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </dialog>
          )}
        </div>
      )}

      {/* TAB 3: Riwayat Transaksi */}
      {tab === "transaksi" && (
        <div className="space-y-6">
          {/* Add Transaction Form */}
          <Card>
            <h2 className="mb-3 text-lg font-bold text-zinc-950 dark:text-zinc-100">Catat Transaksi Beli / Jual</h2>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{cryptoMarket ? "Beli menambah posisi, dan jual mengurangi koin dari pembelian tertua lebih dulu. Catat harga dan biaya dalam rupiah." : "Beli menambah posisi. Jual mengurangi lot tertua lebih dulu. Kelola posisi yang dibeli melalui riwayat transaksi."}</p>
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
                {cryptoMarket ? "Kode Koin" : "Kode Saham"}
                <input
                  type="text"
                  placeholder={cryptoMarket ? "BTC" : "BBCA"}
                  value={txKode}
                  maxLength={cryptoMarket ? 20 : 4}
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

              {cryptoMarket ? (
                <CryptoUnitPriceInput label="Harga per Koin" value={txHarga} currency={txCurrency}
                  onChange={setTxHarga} onCurrencyChange={setTxCurrency} disabled={savingTrade} />
              ) : <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Harga / Lembar (Rp)
                <input
                  type="text"
                  placeholder="9000"
                  value={txHarga}
                  onChange={(e) => setTxHarga(e.target.value)}
                  className={`${input} mt-1`}
                />
              </label>}

              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {quantityLabel}
                <input
                  type={cryptoMarket ? "number" : "text"}
                  step={cryptoMarket ? "any" : undefined}
                  inputMode={cryptoMarket ? "decimal" : undefined}
                  placeholder={cryptoMarket ? "0.05" : "10"}
                  value={txLot}
                  onChange={(e) => setTxLot(e.target.value)}
                  className={`${input} mt-1`}
                />
              </label>

              {cryptoMarket && <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Biaya Transaksi (Rp)
                <input type="number" min={0} step="any" inputMode="decimal" value={txFee} onChange={(e) => setTxFee(e.target.value)} className={`${input} mt-1`} />
              </label>}
              <button
                type="submit"
                disabled={savingTrade || !ready}
                className="h-10 rounded-xl bg-green-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-60"
              >
                {savingTrade ? "Menyimpan…" : "+ Simpan Transaksi"}
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="font-bold text-zinc-950 dark:text-zinc-100">Riwayat Pembelian &amp; Penjualan {assetLabel}</h2>
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
                      <th className="px-3 py-3 text-right">{cryptoMarket ? "Jumlah Koin" : "Lot"}</th>
                      <th className="px-3 py-3 text-right">Harga</th>
                      {cryptoMarket && <th className="px-3 py-3 text-right">Biaya</th>}
                      <th className="px-3 py-3 text-right">Total Transaksi</th>
                      <th className="px-4 py-3">Catatan</th>
                      <th className="px-3 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {transactions.map((t) => {
                      const totalNominal = t.harga * t.lot * multiplier + (cryptoMarket ? (t.tipe === "BELI" ? t.fee : -t.fee) : 0);
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
                          <td className="px-3 py-3 text-right tabular-nums text-zinc-800 dark:text-zinc-200">{formatQuantity(t.lot)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                            {formatPrice(t.harga)}
                            {cryptoMarket && <span className="block whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400">≈ {usdtFromIdr(t.harga)}</span>}
                          </td>
                          {cryptoMarket && <td className="px-3 py-3 text-right tabular-nums">{cryptoPrice(t.fee)}</td>}
                          <td className="px-3 py-3 text-right tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
                            {formatValue(totalNominal)}
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

function CryptoUnitPriceInput({ label, value, currency, onChange, onCurrencyChange, disabled, inputRef }: {
  label: string;
  value: string;
  currency: CryptoPriceCurrency;
  onChange: (value: string) => void;
  onCurrencyChange: (currency: CryptoPriceCurrency) => void;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  const other = currency === "IDR" ? "USDT" : "IDR";
  const equivalent = convertCryptoPrice(Number(value), currency, other);
  return (
    <div className="min-w-0 text-sm font-medium text-zinc-800 dark:text-zinc-200">
      <label htmlFor={id}>{label}</label>
      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input id={id} ref={inputRef} type="number" min={0} step="any" inputMode="decimal" required readOnly={disabled}
          aria-describedby={`${id}-kurs`} className={`${input} min-w-0`} value={value}
          onChange={(event) => onChange(event.target.value)} />
        <select aria-label="Mata uang harga" value={currency} disabled={disabled} className={`${input} w-auto px-2`}
          onChange={(event) => {
            const next = event.target.value as CryptoPriceCurrency;
            const converted = convertCryptoPrice(Number(value), currency, next);
            if (value && Number.isFinite(converted)) onChange(String(Number(converted.toPrecision(15))));
            onCurrencyChange(next);
          }}>
          <option value="IDR">IDR</option>
          <option value="USDT">USDT</option>
        </select>
      </div>
      <p id={`${id}-kurs`} className="mt-1 text-xs font-normal text-zinc-600 dark:text-zinc-400">
        {equivalent > 0 && Number.isFinite(equivalent) && <span className="block font-semibold tabular-nums">≈ {other === "IDR" ? cryptoPrice(equivalent) : usdtPrice(equivalent)}</span>}
        Kurs estimasi {rp(USD_TO_IDR)} per USDT.
      </p>
    </div>
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
