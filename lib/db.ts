import { createClient, type Client, type Transaction } from "@libsql/client/web";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { savedScreenerQuery, screenStocks } from "./screener";
import type { OfflineFill, OfflineTrade, OfflineTradeEnd } from "./paperOffline";
import { CRYPTO_UNITS_PER_COIN, cryptoQuantityUnits, type PortfolioMarket } from "./portfolio";
import type { ListItem } from "./types";

export type HoldingRow = { id: string; kode: string; harga_beli: number; lot: number; transactionId?: string };

export type TransactionRow = {
  id: string;
  user_id: string;
  kode: string;
  tipe: "BELI" | "JUAL";
  harga: number;
  lot: number;
  fee: number;
  tanggal: string;
  catatan: string | null;
  created_at: number;
  linked: number;
};

export type PriceAlertRow = {
  id: string;
  user_id: string;
  kode: string;
  kondisi: "DIATAS" | "DIBAWAH";
  target_harga: number;
  catatan: string | null;
  aktif: number;
  triggered: number;
  created_at: number;
};

const schema = `
    CREATE TABLE IF NOT EXISTS holdings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kode TEXT NOT NULL,
      harga_beli REAL NOT NULL,
      lot REAL NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS watchlist (
      user_id TEXT NOT NULL,
      kode TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, kode)
    );
    CREATE TABLE IF NOT EXISTS saved_filters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      nama TEXT NOT NULL,
      query TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portfolio_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kode TEXT NOT NULL,
      tipe TEXT NOT NULL,
      harga REAL NOT NULL,
      lot REAL NOT NULL,
      fee REAL NOT NULL DEFAULT 0,
      tanggal TEXT NOT NULL,
      catatan TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS crypto_portfolio_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kode TEXT NOT NULL,
      tipe TEXT NOT NULL,
      harga REAL NOT NULL,
      lot INTEGER NOT NULL,
      fee REAL NOT NULL DEFAULT 0,
      tanggal TEXT NOT NULL,
      catatan TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_crypto_tx_user ON crypto_portfolio_transactions(user_id);
    CREATE TABLE IF NOT EXISTS price_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kode TEXT NOT NULL,
      kondisi TEXT NOT NULL,
      target_harga REAL NOT NULL,
      catatan TEXT,
      aktif INTEGER NOT NULL DEFAULT 1,
      triggered INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);
    CREATE INDEX IF NOT EXISTS idx_tx_user ON portfolio_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_user ON price_alerts(user_id);

    CREATE TABLE IF NOT EXISTS portfolio_position_entries (
      sequence INTEGER PRIMARY KEY,
      transaction_id TEXT NOT NULL UNIQUE REFERENCES portfolio_transactions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS filter_monitors (
      filter_id TEXT PRIMARY KEY REFERENCES saved_filters(id) ON DELETE CASCADE,
      matches TEXT,
      checked_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS alert_scan (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      snapshot_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS alert_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      kode TEXT NOT NULL,
      harga REAL NOT NULL,
      query TEXT,
      created_at INTEGER NOT NULL,
      read_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_alert_events_user ON alert_events(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS alert_push_devices (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth_key TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alert_push_users ON alert_push_devices(user_id);
    CREATE TABLE IF NOT EXISTS alert_push_queue (
      event_id TEXT NOT NULL REFERENCES alert_events(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL REFERENCES alert_push_devices(endpoint) ON DELETE CASCADE,
      next_at INTEGER NOT NULL,
      PRIMARY KEY (event_id, endpoint)
    );
    CREATE TABLE IF NOT EXISTS alert_push_config (
      id INTEGER PRIMARY KEY CHECK (id = 1), public_key TEXT NOT NULL, private_key TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS paper_trade_watches (
      user_id TEXT NOT NULL, trade_id TEXT NOT NULL, kode TEXT NOT NULL,
      trade TEXT NOT NULL, registered_at INTEGER NOT NULL, last_checked INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'OPEN', end_at INTEGER, fill TEXT,
      PRIMARY KEY (user_id, trade_id)
    );
    CREATE INDEX IF NOT EXISTS idx_paper_trade_watches_pending ON paper_trade_watches(status, kode, last_checked);
    `;

type LocalDatabase = { mode: "sqlite"; connection: DatabaseSync; tail: Promise<void> };
type RemoteDatabase = { mode: "turso"; client: Client; ready: Promise<void> };
type DatabaseState = LocalDatabase | RemoteDatabase;
const globalDatabase = globalThis as typeof globalThis & { investaraDatabase?: DatabaseState };

function openDatabase(): DatabaseState {
  const remoteUrl = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (remoteUrl || authToken || process.env.VERCEL === "1") {
    if (!remoteUrl || !authToken) {
      throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for hosted Investara.");
    }
    if (!/^(libsql|https):\/\//.test(remoteUrl)) {
      throw new Error("TURSO_DATABASE_URL must use libsql:// or https://.");
    }
    const url = remoteUrl.replace(/^libsql:/, "https:");
    const client = createClient({ url, authToken });
    return { mode: "turso", client, ready: client.executeMultiple(schema) };
  }

  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const connection = new DatabaseSync(path.join(dir, "app.db"));
  try {
    connection.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; " + schema);
    return { mode: "sqlite", connection, tail: Promise.resolve() };
  } catch (error) {
    connection.close();
    throw error;
  }
}

async function databaseState() {
  const current = globalDatabase.investaraDatabase ??= openDatabase();
  if (current.mode === "sqlite") return current;
  try {
    await current.ready;
    return current;
  } catch (error) {
    if (globalDatabase.investaraDatabase === current) {
      delete globalDatabase.investaraDatabase;
      current.client.close();
    }
    throw error;
  }
}

type SqlValue = string | number | null;
type SqlRow = Record<string, unknown>;
type SqlStore = {
  prepare(sql: string): {
    run(...args: SqlValue[]): Promise<{ changes: number }>;
    all(...args: SqlValue[]): Promise<SqlRow[]>;
    get(...args: SqlValue[]): Promise<SqlRow | undefined>;
  };
};

function remoteStore(executor: Client | Transaction): SqlStore {
  return {
    prepare(sql: string) {
      return {
        async run(...args: SqlValue[]) {
          return { changes: (await executor.execute({ sql, args })).rowsAffected };
        },
        async all(...args: SqlValue[]) {
          return (await executor.execute({ sql, args })).rows;
        },
        async get(...args: SqlValue[]) {
          return (await executor.execute({ sql, args })).rows[0];
        },
      };
    },
  };
}

type RunLocal = <T>(work: () => T) => Promise<T>;

function localStore(connection: DatabaseSync, run: RunLocal = async (work) => work()): SqlStore {
  return {
    prepare(sql: string) {
      return {
        run: (...args) => run(() => ({ changes: Number(connection.prepare(sql).run(...args).changes) })),
        all: (...args) => run(() => connection.prepare(sql).all(...args)),
        get: (...args) => run(() => connection.prepare(sql).get(...args)),
      };
    },
  };
}

function queueLocal<T>(state: LocalDatabase, work: () => T | Promise<T>): Promise<T> {
  const pending = state.tail.then(work);
  state.tail = pending.then(() => {}, () => {});
  return pending;
}

async function db(): Promise<SqlStore> {
  const state = await databaseState();
  return state.mode === "turso" ? remoteStore(state.client) : localStore(state.connection, (work) => queueLocal(state, work));
}

export async function syncOfflineTrades(userId: string, trades: OfflineTrade[], ended: OfflineTradeEnd[], now: number) {
  const ids = [...trades, ...ended].map(({ id }) => id);
  if (!ids.length) return { fills: [], settledIds: [] };

  return writeTransaction(async (store) => {
    const register = store.prepare(`INSERT INTO paper_trade_watches (user_id, trade_id, kode, trade, registered_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, trade_id) DO NOTHING`);
    for (const trade of trades) await register.run(userId, trade.id, trade.kode, JSON.stringify(trade), now);

    const finish = store.prepare(`UPDATE paper_trade_watches
      SET status = CASE WHEN ? IS NULL THEN 'CANCELLED' ELSE status END,
          end_at = MIN(COALESCE(end_at, ?), ?)
      WHERE user_id = ? AND trade_id = ? AND status = 'OPEN'`);
    for (const { id, at } of ended) await finish.run(at, at, at, userId, id);

    const rows = await store.prepare(`SELECT trade_id, status, fill FROM paper_trade_watches
      WHERE user_id = ? AND trade_id IN (${ids.map(() => "?").join(", ")})`).all(userId, ...ids);
    const pending = new Set(rows.filter((row) => row.status === "OPEN").map((row) => row.trade_id));
    return {
      fills: rows.flatMap((row) => typeof row.fill === "string" ? [JSON.parse(row.fill) as OfflineFill] : []),
      settledIds: ids.filter((id) => !pending.has(id)),
    };
  });
}

export async function listOfflineWatchCodes(limit: number, after: number) {
  const store = await db();
  const rows = await store.prepare(`SELECT kode FROM paper_trade_watches
    WHERE status = 'OPEN' AND last_checked < ? GROUP BY kode ORDER BY MIN(last_checked), kode LIMIT ?`).all(after, limit);
  return rows.map((row) => String(row.kode));
}

export async function listOfflineWatches(kode: string) {
  const store = await db();
  const rows = await store.prepare(`SELECT user_id, trade, registered_at, end_at FROM paper_trade_watches
    WHERE status = 'OPEN' AND kode = ?`).all(kode);
  return rows.map((row) => ({
    userId: String(row.user_id), trade: JSON.parse(String(row.trade)) as OfflineTrade,
    registeredAt: Number(row.registered_at), endAt: row.end_at === null ? null : Number(row.end_at),
  }));
}

export async function saveOfflineWatchResults(
  kode: string, now: number,
  results: { userId: string; id: string; fill: OfflineFill | null; endAt: number | null }[],
) {
  await writeTransaction(async (store) => {
    const markFilled = store.prepare(`UPDATE paper_trade_watches SET status = 'FILLED', fill = ?
      WHERE user_id = ? AND trade_id = ? AND status = 'OPEN' AND (end_at IS NULL OR end_at >= ?)`);
    const markFinished = store.prepare(`UPDATE paper_trade_watches SET status = 'CANCELLED'
      WHERE user_id = ? AND trade_id = ? AND status = 'OPEN' AND end_at = ?`);
    for (const { userId, id, fill, endAt } of results) {
      if (fill) await markFilled.run(JSON.stringify(fill), userId, id, fill.exitAt);
      else if (endAt !== null) await markFinished.run(userId, id, endAt);
    }
    await store.prepare(`UPDATE paper_trade_watches SET last_checked = MAX(last_checked, ?)
      WHERE kode = ? AND status = 'OPEN' AND registered_at <= ?`).run(now, kode, now);
  });
}

async function writeTransaction<T>(write: (store: SqlStore) => Promise<T>): Promise<T> {
  const state = await databaseState();
  if (state.mode === "sqlite") {
    return queueLocal(state, async () => {
      const { connection } = state;
      connection.exec("BEGIN IMMEDIATE");
      try {
        const result = await write(localStore(connection));
        connection.exec("COMMIT");
        return result;
      } catch (error) {
        connection.exec("ROLLBACK");
        throw error;
      }
    });
  }

  const transaction = await state.client.transaction("write");
  try {
    const result = await write(remoteStore(transaction));
    await transaction.commit();
    return result;
  } catch (error) {
    if (!transaction.closed) await transaction.rollback().catch(() => {});
    throw error;
  } finally {
    transaction.close();
  }
}

export type UserRow = { id: string; username: string; password_hash: string };

export async function findUser(username: string) {
  const store = await db();
  return await store.prepare("SELECT id, username, password_hash FROM users WHERE username = ?").get(username) as unknown as UserRow | undefined;
}

export async function createUser(username: string, passwordHash: string) {
  const store = await db();
  const id = `local:${crypto.randomUUID()}`;
  const result = await store.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(username) DO NOTHING")
    .run(id, username, passwordHash, Date.now());
  return result.changes ? id : null;
}

export async function listWatchlist(userId: string, store?: SqlStore) {
  store ??= await db();
  const rows = await store.prepare("SELECT kode FROM watchlist WHERE user_id = ? ORDER BY created_at").all(userId);
  return rows.map((row) => String(row.kode));
}

export async function addWatch(userId: string, kode: string) {
  const store = await db();
  await store.prepare("INSERT OR IGNORE INTO watchlist (user_id, kode, created_at) VALUES (?, ?, ?)").run(userId, kode, Date.now());
}

export async function removeWatch(userId: string, kode: string) {
  const store = await db();
  await store.prepare("DELETE FROM watchlist WHERE user_id = ? AND kode = ?").run(userId, kode);
}

export type SavedFilter = { id: string; nama: string; query: string; monitor: boolean; checkedAt: number | null };

export async function listFilters(userId: string): Promise<SavedFilter[]> {
  const store = await db();
  const rows = await store.prepare(`SELECT f.id, f.nama, f.query, m.filter_id IS NOT NULL AS monitor, m.checked_at AS checkedAt
    FROM saved_filters f LEFT JOIN filter_monitors m ON m.filter_id = f.id
    WHERE f.user_id = ? ORDER BY f.created_at`).all(userId) as unknown as (Omit<SavedFilter, "monitor"> & { monitor: number })[];
  return rows.map((row) => ({ ...row, monitor: Boolean(row.monitor) }));
}

export async function addFilter(userId: string, nama: string, query: string): Promise<SavedFilter | null> {
  const store = await db();
  const id = crypto.randomUUID();
  const { changes } = await store.prepare(`INSERT INTO saved_filters (id, user_id, nama, query, created_at)
    SELECT ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM saved_filters WHERE user_id = ?) < 50`)
    .run(id, userId, nama, query, Date.now(), userId);
  return changes ? { id, nama, query, monitor: false, checkedAt: null } : null;
}

export async function setFilterMonitor(userId: string, id: string, active: boolean) {
  const store = await db();
  if (active) {
    await store.prepare(`INSERT OR IGNORE INTO filter_monitors (filter_id)
      SELECT id FROM saved_filters WHERE id = ? AND user_id = ?`).run(id, userId);
  } else {
    await store.prepare(`DELETE FROM filter_monitors WHERE filter_id IN
      (SELECT id FROM saved_filters WHERE id = ? AND user_id = ?)`).run(id, userId);
  }
  return (await listFilters(userId)).find((filter) => filter.id === id);
}

export async function deleteFilter(userId: string, id: string) {
  return writeTransaction(async (store) => {
    await store.prepare("DELETE FROM filter_monitors WHERE filter_id IN (SELECT id FROM saved_filters WHERE id = ? AND user_id = ?)").run(id, userId);
    return (await store.prepare("DELETE FROM saved_filters WHERE id = ? AND user_id = ?").run(id, userId)).changes > 0;
  });
}

export class PortfolioPositionError extends Error {}

function tradeTable(market: PortfolioMarket) {
  return market === "crypto" ? "crypto_portfolio_transactions" : "portfolio_transactions";
}

function tradeLedger(market: PortfolioMarket) {
  return market === "crypto" ? "SELECT t.*, 1 AS linked FROM crypto_portfolio_transactions t"
    : "SELECT t.*, a.transaction_id IS NOT NULL AS linked FROM portfolio_transactions t " +
      "LEFT JOIN portfolio_position_entries a ON t.id = a.transaction_id";
}

function storedQuantity(quantity: number, market: PortfolioMarket) {
  if (market === "stock") return quantity;
  const units = cryptoQuantityUnits(quantity);
  if (units === null) throw new PortfolioPositionError("Jumlah koin tidak valid. Gunakan maksimal 8 angka desimal.");
  return units;
}

export async function listHoldings(userId: string, store?: SqlStore, market: PortfolioMarket = "stock"): Promise<HoldingRow[]> {
  const positions = await replayHoldings(userId, store ?? await db(), market);
  return market === "crypto" ? positions.map((position) => ({ ...position, lot: position.lot / CRYPTO_UNITS_PER_COIN })) : positions;
}

async function replayHoldings(userId: string, store: SqlStore, market: PortfolioMarket) {
  // Opening positions predate the linked journal. Legacy journal-only entries do not replay.
  const equityEvents = "SELECT id, kode, harga_beli, lot, 'BELI' AS tipe, 0 AS linked, '' AS tanggal, rowid AS sequence FROM holdings WHERE user_id = ? " +
    "UNION ALL SELECT t.id, t.kode, t.harga, t.lot, t.tipe, 1, t.tanggal, a.sequence FROM portfolio_transactions t " +
    "JOIN portfolio_position_entries a ON a.transaction_id = t.id WHERE t.user_id = ? ORDER BY linked, tanggal, sequence";
  const events = (market === "crypto" ? await store.prepare(
    "SELECT id, kode, harga AS harga_beli, lot, tipe, 1 AS linked, tanggal FROM crypto_portfolio_transactions WHERE user_id = ? ORDER BY tanggal, rowid"
  ).all(userId) : await store.prepare(equityEvents).all(userId, userId)) as unknown as (HoldingRow & { tipe: "BELI" | "JUAL"; linked: 0 | 1; tanggal: string })[];
  const tolerance = market === "crypto" ? 0 : 1e-8;

  const byTicker = new Map<string, HoldingRow[]>();
  const positions: HoldingRow[] = [];
  for (const event of events) {
    let lots = byTicker.get(event.kode);
    if (!lots) byTicker.set(event.kode, lots = []);
    if (event.tipe === "BELI") {
      const position: HoldingRow = {
        id: event.id, kode: event.kode, harga_beli: event.harga_beli, lot: event.lot,
        ...(event.linked ? { transactionId: event.id } : {}),
      };
      lots.push(position);
      positions.push(position);
      continue;
    }

    let remaining = event.lot;
    for (const position of lots) {
      const used = Math.min(position.lot, remaining);
      position.lot -= used;
      remaining -= used;
      if (remaining <= tolerance) break;
    }
    if (remaining > tolerance) {
      const unit = market === "crypto" ? "Jumlah koin" : "Lot";
      throw new PortfolioPositionError(`${unit} ${event.kode} tidak cukup untuk transaksi jual pada tanggal ${event.tanggal}.`);
    }
  }
  return positions.filter((position) => position.lot > tolerance);
}

export function addHoldings(userId: string, holdings: Omit<HoldingRow, "id">[]) {
  return writeTransaction(async (store) => {
    const insert = store.prepare("INSERT INTO holdings (id, user_id, kode, harga_beli, lot, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    const items: HoldingRow[] = [];
    for (const holding of holdings) {
      const id = crypto.randomUUID();
      await insert.run(id, userId, holding.kode, holding.harga_beli, holding.lot, Date.now());
      items.push({ id, ...holding });
    }
    return items;
  });
}

export function updateHolding(userId: string, id: string, h: {
  harga_beli: number; lot: number; expected?: Pick<HoldingRow, "harga_beli" | "lot">;
}, market: PortfolioMarket = "stock") {
  return writeTransaction(async (store) => {
    const opening = market === "stock" ? await store.prepare("SELECT lot FROM holdings WHERE id = ? AND user_id = ?").get(id, userId) : undefined;
    const eligibleBuy = market === "crypto" ? "SELECT t.lot FROM crypto_portfolio_transactions t" :
      "SELECT t.lot FROM portfolio_transactions t JOIN portfolio_position_entries a ON a.transaction_id = t.id";
    const buy = opening ? undefined : await store.prepare(`${eligibleBuy} WHERE t.id = ? AND t.user_id = ? AND t.tipe = 'BELI'`).get(id, userId);
    const entry = opening ?? buy;
    if (!entry) return false;

    const current = (await replayHoldings(userId, store, market)).find((position) => position.id === id);
    const tolerance = market === "crypto" ? 0 : 1e-8;
    if (h.expected && (!current || Math.abs(current.lot - storedQuantity(h.expected.lot, market)) > tolerance || current.harga_beli !== h.expected.harga_beli)) {
      throw new PortfolioPositionError("Posisi sudah berubah. Tutup formulir lalu buka Edit lagi untuk melihat data terbaru.");
    }
    if (buy && !current) return false;

    // Edits specify the lot still held. Keep the quantity already consumed by earlier sales.
    const totalLot = storedQuantity(h.lot, market) + (Number(entry.lot) - (current?.lot ?? 0));
    if (market === "crypto" && !Number.isSafeInteger(totalLot)) throw new PortfolioPositionError("Jumlah koin melebihi batas pencatatan.");
    const update = opening ? "UPDATE holdings SET harga_beli = ?, lot = ? WHERE id = ? AND user_id = ?"
      : `UPDATE ${tradeTable(market)} SET harga = ?, lot = ? WHERE id = ? AND user_id = ? AND tipe = 'BELI'`;
    await store.prepare(update).run(h.harga_beli, totalLot, id, userId);
    await listHoldings(userId, store, market);
    return true;
  });
}

export function deleteHolding(userId: string, id: string) {
  return writeTransaction(async (store) => {
    const opening = await store.prepare("SELECT lot FROM holdings WHERE id = ? AND user_id = ?").get(id, userId);
    if (!opening) return false;
    const remaining = (await listHoldings(userId, store)).find((position) => position.id === id)?.lot ?? 0;
    if (Number(opening.lot) - remaining > 1e-8) {
      throw new PortfolioPositionError("Posisi awal sudah dipakai dalam transaksi jual. Ubah jumlah lot tersisa atau koreksi transaksi jual terlebih dahulu.");
    }
    const changed = (await store.prepare("DELETE FROM holdings WHERE id = ? AND user_id = ?").run(id, userId)).changes > 0;
    if (changed) await listHoldings(userId, store);
    return changed;
  });
}

export async function listTransactions(userId: string, market: PortfolioMarket = "stock") {
  const store = await db();
  const rows = await store.prepare(`${tradeLedger(market)} WHERE t.user_id = ? ORDER BY t.tanggal DESC, t.created_at DESC, t.rowid DESC`)
    .all(userId) as unknown as TransactionRow[];
  return market === "crypto" ? rows.map((row) => ({ ...row, lot: row.lot / CRYPTO_UNITS_PER_COIN })) : rows;
}

export function addTransaction(
  userId: string,
  tx: Omit<TransactionRow, "id" | "user_id" | "created_at" | "linked">,
  applyToHoldings = false,
  requestId?: string,
  market: PortfolioMarket = "stock",
) {
  return writeTransaction(async (store) => {
    const id = requestId ?? crypto.randomUUID();
    const linked = market === "crypto" || applyToHoldings;
    const lot = storedQuantity(tx.lot, market);
    const existing = await store.prepare(`${tradeLedger(market)} WHERE t.id = ? AND t.user_id = ?`).get(id, userId) as unknown as TransactionRow | undefined;
    if (existing) {
      if (existing.kode !== tx.kode || existing.tipe !== tx.tipe || existing.harga !== tx.harga ||
          existing.lot !== lot || existing.fee !== tx.fee || existing.catatan !== tx.catatan ||
          existing.tanggal !== tx.tanggal || Boolean(existing.linked) !== linked) {
        throw new PortfolioPositionError("ID transaksi ini sudah dipakai untuk data yang berbeda.");
      }
      return { ...existing, lot: tx.lot };
    }

    const created_at = Date.now();
    await store.prepare(
      `INSERT INTO ${tradeTable(market)} (id, user_id, kode, tipe, harga, lot, fee, tanggal, catatan, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, userId, tx.kode, tx.tipe, tx.harga, lot, tx.fee, tx.tanggal, tx.catatan, created_at);
    if (linked && market === "stock") {
      await store.prepare("INSERT INTO portfolio_position_entries (transaction_id) VALUES (?)").run(id);
    }
    if (linked) await listHoldings(userId, store, market);
    return { id, user_id: userId, ...tx, created_at, linked: Number(linked) } satisfies TransactionRow;
  });
}

export function deleteTransaction(userId: string, id: string, market: PortfolioMarket = "stock") {
  return writeTransaction(async (store) => {
    if (market === "stock") {
      await store.prepare("DELETE FROM portfolio_position_entries WHERE transaction_id IN (SELECT id FROM portfolio_transactions WHERE id = ? AND user_id = ?)").run(id, userId);
    }
    const changed = (await store.prepare(`DELETE FROM ${tradeTable(market)} WHERE id = ? AND user_id = ?`).run(id, userId)).changes > 0;
    if (changed) await listHoldings(userId, store, market);
    return changed;
  });
}

export async function listPriceAlerts(userId: string) {
  const store = await db();
  return await store.prepare(
    "SELECT id, user_id, kode, kondisi, target_harga, catatan, aktif, triggered, created_at FROM price_alerts WHERE user_id = ? ORDER BY created_at DESC"
  ).all(userId) as unknown as PriceAlertRow[];
}

export async function addPriceAlert(
  userId: string,
  a: Omit<PriceAlertRow, "id" | "user_id" | "created_at" | "triggered" | "aktif">
) {
  const store = await db();
  const id = crypto.randomUUID();
  const created_at = Date.now();
  await store.prepare(
    "INSERT INTO price_alerts (id, user_id, kode, kondisi, target_harga, catatan, aktif, triggered, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)"
  ).run(id, userId, a.kode, a.kondisi, a.target_harga, a.catatan ?? null, created_at);
  return { id, user_id: userId, ...a, catatan: a.catatan ?? null, aktif: 1, triggered: 0, created_at } satisfies PriceAlertRow;
}

export async function deletePriceAlert(userId: string, id: string) {
  const store = await db();
  return (await store.prepare("DELETE FROM price_alerts WHERE id = ? AND user_id = ?").run(id, userId)).changes > 0;
}

export async function togglePriceAlert(userId: string, id: string, aktif: boolean) {
  const store = await db();
  return (await store.prepare("UPDATE price_alerts SET aktif = ?, triggered = CASE WHEN aktif = ? THEN triggered ELSE 0 END WHERE id = ? AND user_id = ?")
    .run(aktif ? 1 : 0, aktif ? 1 : 0, id, userId)).changes > 0;
}

export type AlertEvent = {
  id: string;
  kind: "price" | "filter";
  label: string;
  kode: string;
  harga: number;
  query: string | null;
  created_at: number;
  read_at: number | null;
};

export async function listAlertEvents(userId: string) {
  const store = await db();
  const events = await store.prepare(`SELECT id, kind, label, kode, harga, query, created_at, read_at FROM alert_events
    WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50`).all(userId) as unknown as AlertEvent[];
  const unread = await store.prepare("SELECT count(*) AS count FROM alert_events WHERE user_id = ? AND read_at IS NULL")
    .get(userId);
  return { events, unreadCount: Number(unread?.count ?? 0) };
}

export async function listWatchlistAlertEvents(userId: string, since: number) {
  const store = await db();
  return await store.prepare(`SELECT e.id, e.kind, e.label, e.kode, e.harga, e.query, e.created_at, e.read_at
    FROM alert_events e JOIN watchlist w ON w.user_id = e.user_id AND w.kode = e.kode
    WHERE e.user_id = ? AND e.created_at >= ?
    ORDER BY e.created_at DESC, e.rowid DESC LIMIT 12`).all(userId, since) as unknown as AlertEvent[];
}

export async function markAlertEventsRead(userId: string) {
  const store = await db();
  await store.prepare("UPDATE alert_events SET read_at = ? WHERE user_id = ? AND read_at IS NULL").run(Date.now(), userId);
}

export async function hasMonitoredAlerts() {
  const store = await db();
  return Boolean(await store.prepare(`SELECT 1 FROM price_alerts WHERE aktif = 1
    UNION ALL SELECT 1 FROM filter_monitors LIMIT 1`).get());
}

export async function applyAlertSnapshot(items: ListItem[], snapshotAt: number) {
  const prices = new Map(items.filter((item) => item.harga !== null && Number.isFinite(item.harga) && item.harga > 0)
    .map((item) => [item.kode, item.harga!]));
  if (!prices.size) return;

  await writeTransaction(async (store) => {
    const fresh = await store.prepare(`INSERT INTO alert_scan (id, snapshot_at) VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET snapshot_at = excluded.snapshot_at WHERE alert_scan.snapshot_at < excluded.snapshot_at`).run(snapshotAt);
    if (fresh.changes) {
      const now = Date.now();
      const insert = store.prepare(`INSERT INTO alert_events (id, user_id, kind, label, kode, harga, query, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      const pushEvents = new Map<string, string>();
      async function addEvent(userId: string, kind: AlertEvent["kind"], label: string, kode: string, price: number, query: string | null = null) {
        const id = crypto.randomUUID();
        await insert.run(id, userId, kind, label, kode, price, query, now);
        if (!pushEvents.has(userId)) pushEvents.set(userId, id);
      }
      const alerts = await store.prepare("SELECT * FROM price_alerts WHERE aktif = 1 AND created_at <= ?").all(snapshotAt) as unknown as PriceAlertRow[];
      const updatePrice = store.prepare("UPDATE price_alerts SET triggered = ? WHERE id = ?");
      for (const alert of alerts) {
        const price = prices.get(alert.kode);
        if (price === undefined) continue;
        const hit = alert.kondisi === "DIATAS" ? price >= alert.target_harga : price <= alert.target_harga;
        if (hit === Boolean(alert.triggered)) continue;
        await updatePrice.run(Number(hit), alert.id);
        if (hit) await addEvent(alert.user_id, "price", "Target Rp " + alert.target_harga.toLocaleString("id-ID"), alert.kode, price);
      }

      const filters = await store.prepare(`SELECT f.id, f.user_id, f.nama, f.query, m.matches
        FROM filter_monitors m JOIN saved_filters f ON f.id = m.filter_id`).all() as unknown as
        { id: string; user_id: string; nama: string; query: string; matches: string | null }[];
      const updateFilter = store.prepare("UPDATE filter_monitors SET matches = ?, checked_at = ? WHERE filter_id = ?");
      for (const filter of filters) {
        let query: URLSearchParams;
        try {
          query = savedScreenerQuery(filter.query);
        } catch {
          continue;
        }
        const watchlist = query.get("grup") === "watchlist" ? await listWatchlist(filter.user_id, store) : undefined;
        const previous = new Set<string>(filter.matches ? JSON.parse(filter.matches) : []);
        const matching = screenStocks(items, query, watchlist).filter((item) => prices.has(item.kode));
        const next = new Set(matching.map((item) => item.kode));
        for (const code of previous) if (!prices.has(code)) next.add(code);
        if (filter.matches !== null) {
          for (const { kode } of matching) {
            if (!previous.has(kode)) await addEvent(filter.user_id, "filter", filter.nama, kode, prices.get(kode)!, query.toString());
          }
        }
        await updateFilter.run(JSON.stringify([...next]), snapshotAt, filter.id);
      }
      const queue = store.prepare(`INSERT INTO alert_push_queue (event_id, endpoint, next_at)
        SELECT ?, endpoint, ? FROM alert_push_devices WHERE user_id = ?`);
      for (const [userId, eventId] of pushEvents) await queue.run(eventId, now, userId);
    }
  });
}

export async function savePushDevice(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await writeTransaction(async (store) => {
    // Clear queued notifications when an endpoint changes account.
    await store.prepare(`DELETE FROM alert_push_queue WHERE endpoint IN
      (SELECT endpoint FROM alert_push_devices WHERE endpoint = ? AND user_id <> ?)`).run(sub.endpoint, userId);
    await store.prepare("DELETE FROM alert_push_devices WHERE endpoint = ? AND user_id <> ?").run(sub.endpoint, userId);
    await store.prepare(`INSERT INTO alert_push_devices (endpoint, user_id, p256dh, auth_key) VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth_key = excluded.auth_key`)
      .run(sub.endpoint, userId, sub.keys.p256dh, sub.keys.auth);
  });
}

export async function removePushDevice(endpoint: string, userId: string) {
  await writeTransaction(async (store) => {
    await store.prepare(`DELETE FROM alert_push_queue WHERE endpoint IN
      (SELECT endpoint FROM alert_push_devices WHERE endpoint = ? AND user_id = ?)`).run(endpoint, userId);
    await store.prepare("DELETE FROM alert_push_devices WHERE endpoint = ? AND user_id = ?").run(endpoint, userId);
  });
}

export async function claimPushJobs(now: number) {
  const store = await db();
  await store.prepare("DELETE FROM alert_push_queue WHERE event_id IN (SELECT id FROM alert_events WHERE created_at < ?)").run(now - 86_400_000);
  const claimed = await store.prepare(`UPDATE alert_push_queue SET next_at = ? WHERE rowid IN
    (SELECT rowid FROM alert_push_queue WHERE next_at <= ? ORDER BY next_at LIMIT 20) RETURNING event_id, endpoint`)
    .all(now + 300_000, now) as unknown as { event_id: string; endpoint: string }[];
  const select = store.prepare(`SELECT d.user_id, d.p256dh, d.auth_key FROM alert_push_devices d
    JOIN alert_events e ON e.user_id = d.user_id WHERE d.endpoint = ? AND e.id = ?`);
  const jobs = await Promise.all(claimed.map(async (job) => {
    const device = await select.get(job.endpoint, job.event_id) as unknown as { user_id: string; p256dh: string; auth_key: string } | undefined;
    return device ? { ...job, ...device } : null;
  }));
  return jobs.filter((job) => job !== null);
}

export async function finishPushJob(eventId: string, endpoint: string) {
  const store = await db();
  await store.prepare("DELETE FROM alert_push_queue WHERE event_id = ? AND endpoint = ?").run(eventId, endpoint);
}

export async function getPushKeys(generate: () => { publicKey: string; privateKey: string }) {
  const store = await db();
  const select = store.prepare("SELECT public_key AS publicKey, private_key AS privateKey FROM alert_push_config WHERE id = 1");
  const existing = await select.get() as unknown as ReturnType<typeof generate> | undefined;
  if (existing) return existing;
  const keys = generate();
  await store.prepare("INSERT OR IGNORE INTO alert_push_config (id, public_key, private_key) VALUES (1, ?, ?)").run(keys.publicKey, keys.privateKey);
  const saved = await select.get() as unknown as ReturnType<typeof generate> | undefined;
  if (!saved) throw new Error("Web Push keys could not be stored.");
  return saved;
}
