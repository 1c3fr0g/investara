const assert = require("node:assert/strict");
const { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmdirSync, unlinkSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

function loadLibrary(name, dependencies = {}) {
  const cache = new Map();
  const load = (filename) => {
    if (cache.has(filename)) return cache.get(filename).exports;
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    const module = { exports: {} };
    cache.set(filename, module);
    const loadDependency = (id) => id.startsWith(".")
      ? load(path.resolve(path.dirname(filename), id + ".ts"))
      : dependencies[id] ?? require(id);
    new Function("require", "module", "exports", outputText)(loadDependency, module, module.exports);
    return module.exports;
  };
  return load(path.resolve(__dirname, "../lib", name + ".ts"));
}

async function withLocalDatabase(run) {
  const original = process.cwd();
  const temporaryRoot = path.resolve(__dirname, "../node_modules/.cache");
  mkdirSync(temporaryRoot, { recursive: true });
  const root = realpathSync(temporaryRoot);
  const isolated = mkdtempSync(path.join(root, "investara-check-"));
  process.chdir(isolated);
  try {
    await run(loadLibrary("db"));
  } finally {
    globalThis.investaraDatabase?.connection.close();
    delete globalThis.investaraDatabase;
    process.chdir(original);
    if (path.dirname(isolated) === root && path.basename(isolated).startsWith("investara-check-")) {
      const data = path.join(isolated, "data");
      for (const name of ["app.db", "app.db-wal", "app.db-shm", "app.db-journal"]) {
        const file = path.join(data, name);
        if (existsSync(file)) unlinkSync(file);
      }
      if (existsSync(data)) rmdirSync(data);
      rmdirSync(isolated);
    }
  }
}

test("linked portfolio entries apply FIFO and roll back impossible revisions", async () => {
  await withLocalDatabase(async (database) => {
    const { addHoldings, addTransaction, listHoldings, listTransactions, updateHolding, deleteTransaction, PortfolioPositionError } = database;
    const [opening] = await addHoldings("member", [{ kode: "BBCA", lot: 5, harga_beli: 9000 }]);
    const buy = { kode: "BBCA", tipe: "BELI", lot: 4, harga: 9500, fee: 0, tanggal: "2026-01-01", catatan: "" };
    await addTransaction("member", buy); // History from before linking stays in the journal.
    const key = "3fbab877-425c-4750-a99e-b850ec0f192e";
    const [linked, retry] = await Promise.all([
      addTransaction("member", buy, true, key),
      addTransaction("member", buy, true, key),
    ]);
    assert.equal(retry.id, linked.id);
    await assert.rejects(() => addTransaction("member", { ...buy, lot: 9 }, true, key), PortfolioPositionError);
    const sell = { ...buy, tipe: "JUAL", lot: 7, tanggal: "2026-01-02" };
    const sale = await addTransaction("member", sell, true);
    assert.deepEqual((await listHoldings("member")).map(({ lot, harga_beli }) => [lot, harga_beli]), [[2, 9500]]);
    assert.equal((await listTransactions("member")).length, 3);
    await assert.rejects(() => deleteTransaction("member", linked.id), PortfolioPositionError);
    await assert.rejects(() => addTransaction("member", { ...sell, lot: 3 }, true), PortfolioPositionError);
    assert.equal((await listTransactions("member")).length, 3);
    assert.equal(await deleteTransaction("someone-else", sale.id), false);
    assert.deepEqual(await listHoldings("someone-else"), []);
    assert.equal(await deleteTransaction("member", sale.id), true);
    assert.equal(await updateHolding("member", opening.id, { harga_beli: 9000, lot: 6 }), true);
    assert.deepEqual((await listHoldings("member")).map(({ lot }) => lot), [6, 4]);
  });
});

test("existing SQLite data remains readable and scheduled snapshots do not duplicate alerts", async () => {
  await withLocalDatabase(async (database) => {
    const { DatabaseSync } = require("node:sqlite");
    mkdirSync("data");
    const original = new DatabaseSync("data/app.db");
    original.exec("CREATE TABLE watchlist (user_id TEXT NOT NULL, kode TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, kode)); INSERT INTO watchlist VALUES ('member', 'BBCA', 1);");
    original.close();
    assert.deepEqual(await database.listWatchlist("member"), ["BBCA"]);
    assert.ok(await database.createUser("member", "test-hash"));
    assert.equal(await database.createUser("member", "duplicate"), null);

    await database.addPriceAlert("member", { kode: "BBCA", kondisi: "DIATAS", target_harga: 9000 });
    assert.equal(await database.hasMonitoredAlerts(), true);
    const now = Date.now();
    await database.applyAlertSnapshot([{ kode: "BBCA", harga: 9500 }], now);
    await database.applyAlertSnapshot([{ kode: "BBCA", harga: 9500 }], now);
    assert.equal((await database.listAlertEvents("member")).unreadCount, 1);
    await database.applyAlertSnapshot([{ kode: "BBCA", harga: 8500 }], now + 1);
    await database.applyAlertSnapshot([{ kode: "BBCA", harga: 9500 }], now + 2);
    assert.equal((await database.listAlertEvents("member")).unreadCount, 2);
  });
});

test("the scheduled alert route requires its server secret", async () => {
  const previousSecret = process.env.CRON_SECRET;
  const previousEnabled = process.env.ALERT_MONITOR_ENABLED;
  let scans = 0;
  const { GET } = loadLibrary("../app/api/internal/alerts/sweep/route", {
    "@/lib/alertMonitor": { async runAlertCycle() { scans++; } },
  });
  const url = "https://example.test/api/internal/alerts/sweep";
  const authorized = new Request(url, { headers: { authorization: "Bearer test-cron-secret" } });
  try {
    delete process.env.CRON_SECRET;
    delete process.env.ALERT_MONITOR_ENABLED;
    assert.equal((await GET(authorized)).status, 503);
    process.env.CRON_SECRET = "test-cron-secret";
    assert.equal((await GET(new Request(url))).status, 401);
    assert.equal((await GET(new Request(url, { headers: { authorization: "Bearer wrong-value-123" } }))).status, 401);
    assert.equal(scans, 0);
    assert.equal((await GET(authorized)).status, 200);
    assert.equal(scans, 1);
    process.env.ALERT_MONITOR_ENABLED = "0";
    assert.equal((await GET(authorized)).status, 503);
    assert.equal(scans, 1);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
    if (previousEnabled === undefined) delete process.env.ALERT_MONITOR_ENABLED;
    else process.env.ALERT_MONITOR_ENABLED = previousEnabled;
  }
});

test("crypto uses real quotes and retains their timestamps when upstream feeds fail", async (context) => {
  const start = Date.now();
  let now = start;
  let upstreamAvailable = true;
  context.mock.method(Date, "now", () => now);
  context.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (!upstreamAvailable) return new Response(null, { status: 503 });
    if (url.hostname === "api.binance.com") {
      return Response.json([
        { symbol: "BTCUSDT", lastPrice: "100", priceChangePercent: "-2", quoteVolume: "400000", closeTime: start },
        { symbol: "TESTUSDT", lastPrice: "2", priceChangePercent: "16", quoteVolume: "200000", closeTime: start },
      ]);
    }
    throw new Error("Unexpected upstream request");
  });
  class Yahoo {
    async quote() { return []; }
    async chart() { return { quotes: [] }; }
  }
  const { getCryptoUniverse, getCryptoDetail, getLiveFearAndGreed } = loadLibrary("crypto", { "yahoo-finance2": Yahoo });
  assert.equal((await getLiveFearAndGreed()).value, null);
  const listing = await getCryptoUniverse();
  assert.equal(listing.updatedAt, start);
  const btc = listing.items.find((item) => item.symbol === "BTC");
  assert.equal(btc.price_usd, 100);
  assert.equal(btc.quoteCurrency, "USDT");
  const dynamic = listing.items.find((item) => item.symbol === "TEST");
  assert.equal(dynamic.market_cap_usd, null);
  assert.equal(dynamic.change_7d, null);
  assert.equal(dynamic.ath_usd, null);
  assert.equal(dynamic.rank, null);
  const detail = await getCryptoDetail("BTC");
  assert.deepEqual(detail.history, []);
  assert.equal(detail.recommendation, null);
  assert.ok(detail.returnSimulations.every((period) => !period.isAvailable));
  now += 20_000;
  upstreamAvailable = false;
  const stale = await getCryptoUniverse();
  assert.equal(stale.updatedAt, start);
  assert.ok(stale.items.every((item) => item.stale));
});

test("macro quotes distinguish unavailable data and preserve timestamps during outages", async (context) => {
  const observedAt = Date.now() - 5000;
  let available = true;
  class Yahoo {
    async quote(symbol) {
      if (!available || symbol !== "IDR=X") return null;
      return { regularMarketPrice: 16700, regularMarketTime: new Date(observedAt), regularMarketChangePercent: -0.2 };
    }
  }
  context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));
  const { getMacroData } = loadLibrary("macro", { "yahoo-finance2": Yahoo });
  const first = await getMacroData(true);
  assert.equal(first.indicators[0].observedAt, observedAt);
  assert.equal(first.indicators[0].status, "observed");
  assert.equal(first.indicators[1].status, "unavailable");
  assert.equal(first.indicators[1].price, null);
  assert.deepEqual(first.news, []);
  available = false;
  const second = await getMacroData(true);
  assert.equal(second.indicators[0].status, "stale");
  assert.equal(second.indicators[0].observedAt, observedAt);
});

test("chat enforces bounded bodies, validates attachments and limits request budgets", async () => {
  const { readChatRequest, validateChatAttachments, useChatBudget } = loadLibrary("chatRequest");
  const small = new Request("https://example.test/chat", { method: "POST", body: "{}" });
  assert.deepEqual(await readChatRequest(small), {});
  const tooLarge = new Request("https://example.test/chat", { method: "POST", headers: { "Content-Length": String(22 * 1024 * 1024) }, body: "{}" });
  await assert.rejects(() => readChatRequest(tooLarge), { status: 413 });
  assert.equal(validateChatAttachments([{ type: "image", mimeType: "image/png", dataUrl: "data:image/png;base64,YQ==" }]), true);
  assert.equal(validateChatAttachments([{ type: "video", mimeType: "image/png", dataUrl: "data:image/png;base64,YQ==" }]), false);
  for (let i = 0; i < 16; i++) assert.equal(useChatBudget("member", 100_000), null);
  assert.ok(useChatBudget("member", 100_001) > 0);
  assert.equal(useChatBudget("member", 160_000), null);
});
