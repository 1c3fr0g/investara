const assert = require("node:assert/strict");
const { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmdirSync, unlinkSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

const offlineTrade = { id: "pt_offline_bbca", kode: "BBCA", entryAt: 60_000, targetTp1: 1015, targetTp2: 1030, stopLoss: 980 };

function loadLibrary(name, dependencies = {}) {
  const cache = new Map();
  const load = (filename) => {
    if (cache.has(filename)) return cache.get(filename).exports;
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    });
    const module = { exports: {} };
    cache.set(filename, module);
    const loadDependency = (id) => Object.hasOwn(dependencies, id) ? dependencies[id] : id.startsWith(".")
      ? load(path.resolve(path.dirname(filename), id + ".ts"))
      : require(id);
    new Function("require", "module", "exports", outputText)(loadDependency, module, module.exports);
    return module.exports;
  };
  return load(path.resolve(__dirname, "../lib", path.extname(name) ? name : name + ".ts"));
}

test("stock activity ranks real broker sides and keeps same-day OHLCV out of the completed CMF", () => {
  const { completedMoneyFlow, parseBrokerActivity } = loadLibrary("stockActivity");
  const summary = parseBrokerActivity([
    { code: "LG", name: "Broker LG", buy_value: "10000", sell_value: "2000", buy_volume: "10", sell_volume: "4" },
    { code: "CC", buy_value: "0", sell_value: "8000", buy_volume: "0", sell_volume: "6" },
    { code: "NI", buy_value: "1000", sell_value: "1000", buy_volume: "1", sell_volume: "1" },
  ]);
  assert.deepEqual(summary.buyers.map((row) => [row.code, row.netValue, row.netShares, row.buyAverage]), [["LG", 8000, 6, 1000]]);
  assert.deepEqual(summary.sellers.map((row) => [row.code, row.netValue, row.buyAverage]), [["CC", -8000, null]]);
  assert.throws(() => parseBrokerActivity([{ code: "LG", buy_value: "missing" }]));

  const now = Date.parse("2026-11-24T00:00:00+07:00");
  const candles = Array.from({ length: 21 }, (_, i) => ({ time: now - i * 86400000, high: 105, low: 95, close: i ? 105 : 95, volume: 100 }));
  assert.deepEqual(completedMoneyFlow(candles, now), { value: 1, date: "2026-11-23" });
  assert.equal(completedMoneyFlow(candles.slice(0, -1), now), null);
});

test("insider activity preserves report and transaction dates in WIB and keeps disclosures distinct from purchases", () => {
  const { activityPeriod, parseInsiderReports } = loadLibrary("stockActivity");
  assert.deepEqual(activityPeriod(7, Date.parse("2026-11-23T23:25:00Z")), { from: "2026-11-18", to: "2026-11-24" });
  const data = parseInsiderReports({ page: 1, nextPage: 2, data: [{
    date: "2026-11-24T23:55:00.000Z", code: "BBCA", name: "Pelapor", badge: "{DIREKSI, PENGENDALI}",
    prev_val: "100000", next_val: "110000", change: 0.02, prev_percent: 0, next_percent: 0.02, purpose: "Investasi",
    subrow: [{ date: "2026-11-21T23:55:00.000Z", status: "Hibah", price: null, value: 10000 }],
  }] }, "BBCA", 1);
  assert.equal(data.nextPage, 2);
  assert.deepEqual(data.reports[0], {
    published: "2026-11-24", name: "Pelapor", role: "DIREKSI, PENGENDALI", purpose: "Investasi",
    before: 100000, after: 110000, beforePct: 0, afterPct: 0.02,
    transactions: [{ date: "2026-11-21", type: "Hibah", shares: 10000, price: null }],
  });
  assert.throws(() => parseInsiderReports({ page: 2, nextPage: 3, data: [] }, "BBCA", 1));
});

test("stock activity request distinguishes a missing credential, restricted plan and provider outage", async () => {
  const { getStockActivity } = loadLibrary("stockActivityProvider");
  const originalKey = process.env.INVEZGO_API_KEY;
  const originalFetch = global.fetch;
  try {
    delete process.env.INVEZGO_API_KEY;
    let publicCalls = 0;
    global.fetch = async (url) => {
      assert.equal(url.hostname, "ihsg.midoriresearch.com");
      publicCalls++;
      return new Response(null, { status: 502 });
    };
    assert.equal((await getStockActivity("BBCA", "broker", 7, 1)).status, "unconfigured");
    assert.equal(publicCalls, 2);
    process.env.INVEZGO_API_KEY = "test-only";
    global.fetch = async (url, options) => {
      assert.equal(url.hostname, "api.invezgo.com");
      assert.equal(url.pathname, "/analysis/shareholder-insider");
      assert.equal(url.searchParams.get("code"), "BBCA");
      assert.equal(url.searchParams.get("page"), "2");
      assert.equal(options.headers.Authorization, "Bearer test-only");
      return new Response(null, { status: 402 });
    };
    assert.equal((await getStockActivity("BBCA", "insider", 30, 2)).status, "restricted");
    global.fetch = async () => new Response(null, { status: 503 });
    assert.equal((await getStockActivity("BBCA", "broker", 7, 1)).status, "unavailable");
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.INVEZGO_API_KEY;
    else process.env.INVEZGO_API_KEY = originalKey;
  }
});

test("public stock activity keeps foreign snapshots dated and rejects mismatched broker filters", () => {
  const { getCuratedReports, parseForeignSnapshot, parsePublicBrokers } = loadLibrary("publicStockActivity");
  const period = { from: "2026-11-18", to: "2026-11-25" };
  const broker = { schema: "idx.broker.v1", provider: "ipot", data: [{
    symbol: "ANTM", ...period, investor: "all", board: "regular",
    buyers: [{ code: "LG", lots: 11, value: 80_000, average_price: null }], sellers: [],
  }] };
  assert.deepEqual(parsePublicBrokers(broker, "ANTM", period).buyers.map(({ code, lots, value }) => [code, lots, value]), [["LG", 11, 80000]]);
  assert.throws(() => parsePublicBrokers(broker, "ANTM", { ...period, from: "2026-11-17" }));

  const snapshot = { schema: "idx.market.foreign.value.v1", provider: "ipot", stale: true, data: {
    date: "2026-11-09", net_buy: [], net_sell: [{ symbol: "ANTM", foreign_net_value: -75400000000 }],
  } };
  assert.deepEqual(parseForeignSnapshot(snapshot, "ANTM", period.to), { date: "2026-11-09", netValue: -75400000000, stale: true });
  assert.equal(parseForeignSnapshot(snapshot, "BBCA", period.to), null);
  assert.equal(parseForeignSnapshot(snapshot, "ANTM", "2026-11-08"), null);
  const [report] = getCuratedReports("ANTM", period, 1);
  assert.equal(report.transactions[0].price, 2720);
  assert.equal(new URL(report.document.url).hostname, "www.idx.co.id");
  assert.deepEqual(getCuratedReports("ANTM", { ...period, from: "2026-11-19" }, 1), []);
});

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

test("the account menu keeps its initial placeholder even when the session is already loaded", () => {
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  let session = { status: "loading" };
  const { AuthMenu } = loadLibrary("../components/AuthButtons.tsx", {
    "next-auth/react": { useSession: () => session },
  });

  const placeholder = renderToString(React.createElement(AuthMenu));
  session = { status: "authenticated", data: { user: { name: "Test Account" } } };
  assert.equal(renderToString(React.createElement(AuthMenu)), placeholder);
  session = { status: "unauthenticated", data: null };
  assert.equal(renderToString(React.createElement(AuthMenu)), placeholder);
});

test("watchlist activity scopes alerts before limiting and keeps recent issuer news during a feed outage", async () => {
  await withLocalDatabase(async (database) => {
    const now = Date.now();
    const user = await database.createUser("radar-main", "unused");
    const otherUser = await database.createUser("radar-other", "unused");
    await database.addWatch(user, "BBCA");
    await database.addWatch(user, "BMRI");
    await database.addWatch(otherUser, "BBCA");
    const connection = globalThis.investaraDatabase.connection;
    const insert = connection.prepare("INSERT INTO alert_events (id, user_id, kind, label, kode, harga, query, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    insert.run("match", user, "filter", "Filter saya", "BBCA", 9000, "sort=mcap", now - 5000);
    insert.run("target", user, "price", "Target Rp 9.000", "BMRI", 9000, null, now - 2000);
    insert.run("old", user, "price", "Target lama", "BBCA", 9000, null, now - 4 * 86_400_000);
    insert.run("other", otherUser, "price", "Alert akun lain", "BBCA", 9000, null, now - 5);
    for (let index = 0; index < 52; index++) {
      insert.run("ignored" + index, user, "price", "Saham di luar watchlist", "BBNI", 9000, null, now - index);
    }
    for (const kode of ["BBRI", "TLKM", "ASII", "ANTM"]) await database.addWatch(user, kode);
    const stamp = connection.prepare("UPDATE watchlist SET created_at = ? WHERE user_id = ? AND kode = ?");
    ["BBCA", "BMRI", "BBRI", "TLKM", "ASII", "ANTM"].forEach((kode, index) => stamp.run(now + index, user, kode));

    const article = (id, judul, publishedAt) => ({
      id, judul, publishedAt, penerbit: "Media Uji", url: "https://example.com/" + id,
    });
    const activity = loadLibrary("watchlistActivity", {
      "./emiten.json": require("../lib/emiten.json"),
      "./news": {
        readNewsFeed: async (query) => {
          if (!query.includes('"BBCA"')) throw new Error("Feed unavailable");
          return [
            article("recent", "Bank Central Asia dan BMRI umumkan hasil", now - 1000),
            article("duplicate", "Bank Central Asia dan BMRI umumkan hasil", now - 3000),
            article("generic", "Saham perbankan bergerak", now - 500),
            article("old", "BBCA membagi dividen", now - 4 * 86_400_000),
          ];
        },
      },
    });
    let activeUser;
    const { GET } = loadLibrary("../app/api/watchlist/activity/route.ts", {
      "next/server": { NextResponse: Response },
      "@/auth": { auth: async () => activeUser ? { user: { id: activeUser } } : null },
      "@/lib/db": database,
      "@/lib/format": loadLibrary("format"),
      "@/lib/watchlistActivity": activity,
    });
    assert.equal((await GET()).status, 401);
    activeUser = user;
    const response = await GET();
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const result = await response.json();
    assert.equal(result.newsStatus, "partial");
    assert.deepEqual(result.items.map(({ id, kodes, href }) => [id, kodes, href]), [
      ["news:recent", ["BBCA", "BMRI"], "https://example.com/recent"],
      ["alert:target", ["BMRI"], "/saham/BMRI"],
      ["alert:match", ["BBCA"], "/?sort=mcap"],
    ]);
    await database.removeWatch(user, "BMRI");
    const updated = await (await GET()).json();
    assert.deepEqual(updated.items.flatMap(({ kodes }) => kodes), ["BBCA", "BBCA"]);
  });
});

test("offline fills use complete candles after activation and respect the first observed exit", () => {
  const { findOfflineFill, PAPER_BAR_MS: bar } = loadLibrary("paperOffline");
  const preActivation = { at: bar, open: 1000, high: 1035, low: 995 };
  const bothTargets = { at: 2 * bar, open: 1000, high: 1035, low: 995 };
  const gap = { at: 3 * bar, open: 1035, high: 1040, low: 1010 };
  assert.equal(findOfflineFill(offlineTrade, bar + 1, 3 * bar - 1, [preActivation, bothTargets]), null);
  assert.deepEqual(findOfflineFill(offlineTrade, bar + 1, 4 * bar, [preActivation, bothTargets, gap]), {
    id: offlineTrade.id, status: "TP1_HIT", exitAt: 3 * bar, exitPrice: 1015,
  });
  assert.equal(findOfflineFill(offlineTrade, 3 * bar, 4 * bar, [gap]).status, "TP2_HIT");
  assert.equal(findOfflineFill(offlineTrade, bar, 3 * bar, [{ ...bothTargets, low: 970 }]).status, "SL_HIT");
});

test("offline sweep persists scoped fills, and retries a provider outage", async () => {
  await withLocalDatabase(async (database) => {
    const { PAPER_BAR_MS: bar } = loadLibrary("paperOffline");
    const registered = bar + 1;
    const localEnd = 4 * bar + 1;
    let available = false;
    const { runOfflinePaperSweep } = loadLibrary("paperOfflineMonitor", {
      "./db": database,
      "./market": { getPaperIntradayBars: async () => {
        if (!available) throw new Error("Provider unavailable");
        return [{ at: 2 * bar, open: 1000, high: 1017, low: 995 }];
      } },
    });

    await database.syncOfflineTrades("first", [offlineTrade], [], registered);
    await database.syncOfflineTrades("second", [offlineTrade], [], registered);
    await database.syncOfflineTrades("second", [], [{ id: offlineTrade.id, at: null }], registered + 1);
    await database.syncOfflineTrades("first", [], [{ id: offlineTrade.id, at: localEnd }], localEnd);
    assert.deepEqual(await database.syncOfflineTrades("stranger", [], [{ id: offlineTrade.id, at: null }], localEnd), {
      fills: [], settledIds: [offlineTrade.id],
    });

    assert.deepEqual(await runOfflinePaperSweep(5 * bar), { checked: 1, failed: 1 });
    assert.equal((await database.listOfflineWatches("BBCA")).length, 1);
    available = true;
    assert.deepEqual(await runOfflinePaperSweep(6 * bar), { checked: 1, failed: 0 });
    assert.deepEqual(await database.syncOfflineTrades("first", [offlineTrade], [], 6 * bar), {
      fills: [{ id: offlineTrade.id, status: "TP1_HIT", exitAt: 3 * bar, exitPrice: 1015 }], settledIds: [offlineTrade.id],
    });
    assert.deepEqual(await database.syncOfflineTrades("second", [offlineTrade], [], 6 * bar), {
      fills: [], settledIds: [offlineTrade.id],
    });
    assert.deepEqual(await database.listOfflineWatches("BBCA"), []);
  });
});

test("a recovered offline fill replaces a later local simulation exit once", () => {
  const { openPaperTrade, evaluateTradesWithLivePrices, savePaperTrades, applyOfflinePaperFills, getPaperTrades } = loadLibrary("paperTrading");
  const trade = openPaperTrade({ kode: "BBCA", nama: "BBCA", entryPrice: 1000, lot: 1 });
  const quoteAt = Date.parse(trade.entryDate) + 600_000;
  const quotes = new Map([["BBCA", { price: 1035, at: quoteAt }]]);
  savePaperTrades(evaluateTradesWithLivePrices([trade], quotes, quoteAt).updatedTrades);
  const exitAt = quoteAt - 1;
  const fill = { id: trade.id, status: "TP1_HIT", exitAt, exitPrice: 1015 };
  applyOfflinePaperFills([fill]);
  const settled = getPaperTrades();
  assert.equal(settled[0].status, "TP1_HIT");
  assert.equal(settled[0].realizedPnlRp, 1500);
  applyOfflinePaperFills([fill]);
  assert.strictEqual(getPaperTrades(), settled);
});

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

test("crypto portfolio prices convert to IDR and weight open purchases by the remaining quantity", () => {
  const { averageOpenBuyPrices } = loadLibrary("portfolio");
  const { convertCryptoPrice } = loadLibrary("cryptoCurrency");
  const positions = [
    { kode: "BTC", lot: 0.05, harga_beli: convertCryptoPrice(40_000, "USDT", "IDR") },
    { kode: "BTC", lot: 0.15, harga_beli: convertCryptoPrice(60_000, "USDT", "IDR") },
    { kode: "ETH", lot: 0.00000001, harga_beli: convertCryptoPrice(2_000, "USDT", "IDR") },
  ];
  const averages = averageOpenBuyPrices(positions);
  assert.deepEqual(averages.map(({ symbol, quantity, priceIdr }) => [symbol, quantity, convertCryptoPrice(priceIdr, "IDR", "USDT")]),
    [["BTC", 0.2, 55_000], ["ETH", 0.00000001, 2_000]]);
  assert.deepEqual(averageOpenBuyPrices(positions.slice(1)).map(({ symbol, priceIdr }) => [symbol, convertCryptoPrice(priceIdr, "IDR", "USDT")]),
    [["BTC", 60_000], ["ETH", 2_000]]);
});

test("the crypto portfolio handles fractional FIFO, update, retry, and account isolation through its API", async () => {
  await withLocalDatabase(async (database) => {
    await database.addHoldings("member", [{ kode: "BBCA", lot: 5, harga_beli: 9000 }]);
    let userId = null;
    const api = loadLibrary("../app/api/crypto/portofolio/route", {
      "@/auth": { auth: async () => userId ? { user: { id: userId } } : null },
      "@/lib/db": database,
      "@/lib/portfolio": loadLibrary("portfolio"),
    });
    const base = "https://example.test/api/crypto/portofolio";
    const request = (method, body) => new Request(base, { method, body: JSON.stringify(body) });
    assert.equal((await api.GET()).status, 401);
    userId = "member";
    const buy = { kode: "BTC", tipe: "BELI", harga: 1_500_000_000, lot: 0.00000002, fee: 1, tanggal: "2025-01-01", requestId: crypto.randomUUID() };
    const purchase = await api.POST(request("POST", buy));
    assert.equal(purchase.status, 201);
    const { transaction } = await purchase.json();
    assert.equal(transaction.lot, 0.00000002);
    assert.equal((await api.POST(request("POST", buy))).status, 201);
    assert.equal((await api.POST(request("POST", { ...buy, lot: 0.000000001, requestId: undefined }))).status, 400);

    const sale = { ...buy, tipe: "JUAL", lot: 0.00000001, tanggal: "2025-01-02", requestId: undefined };
    assert.equal((await api.POST(request("POST", sale))).status, 201);
    assert.equal((await api.POST(request("POST", { ...sale, lot: 0.00000002 }))).status, 409);
    const edited = await api.PUT(request("PUT", {
      id: transaction.id, harga_beli: 1_600_000_000, lot: 0.00000003,
      expected: { harga_beli: 1_500_000_000, lot: 0.00000001 },
    }));
    assert.equal(edited.status, 200);
    const { items, transactions } = await edited.json();
    assert.deepEqual(items.map(({ kode, lot, harga_beli }) => [kode, lot, harga_beli]), [["BTC", 0.00000003, 1_600_000_000]]);
    assert.deepEqual(transactions.map(({ tipe, lot }) => [tipe, lot]), [["JUAL", 0.00000001], ["BELI", 0.00000004]]);
    const removeBuy = new Request(`${base}?id=${transaction.id}`, { method: "DELETE" });
    assert.equal((await api.DELETE(removeBuy)).status, 409);
    assert.equal((await database.listHoldings("member"))[0].kode, "BBCA");
    assert.deepEqual(await database.listTransactions("member"), []);
    userId = "other-member";
    assert.deepEqual(await (await api.GET()).json(), { items: [], transactions: [] });
    assert.equal((await api.DELETE(removeBuy)).status, 404);
    userId = "member";
    const removed = await api.DELETE(new Request(`${base}?id=${transactions[0].id}`, { method: "DELETE" }));
    assert.equal(removed.status, 200);
    assert.equal((await removed.json()).items[0].lot, 0.00000004);
  });
});

test("editing a linked holding changes its buy and keeps previously sold lots", async () => {
  await withLocalDatabase(async ({ addTransaction, listHoldings, listTransactions, updateHolding, PortfolioPositionError }) => {
    const data = { kode: "BBCA", harga: 9000, lot: 10, fee: 50, tanggal: "2026-01-01", catatan: "original" };
    const buy = await addTransaction("member", { ...data, tipe: "BELI" }, true);
    const sell = await addTransaction("member", { ...data, tipe: "JUAL", lot: 4, tanggal: "2026-01-02" }, true);
    const revision = { harga_beli: 9200, lot: 8, expected: { harga_beli: 9000, lot: 6 } };

    assert.equal(await updateHolding("other-member", buy.id, revision), false);
    assert.equal(await updateHolding("member", sell.id, revision), false);
    assert.equal(await updateHolding("member", buy.id, revision), true);
    assert.deepEqual(await listHoldings("member"), [{ id: buy.id, kode: "BBCA", harga_beli: 9200, lot: 8, transactionId: buy.id }]);
    const [savedSale, savedBuy] = await listTransactions("member");
    assert.equal(savedSale.lot, 4);
    assert.deepEqual([savedBuy.harga, savedBuy.lot, savedBuy.fee, savedBuy.catatan], [9200, 12, 50, "original"]);
    await assert.rejects(() => updateHolding("member", buy.id, { ...revision, lot: 2 }), PortfolioPositionError);
    assert.equal((await listHoldings("member"))[0].lot, 8);
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

test("paper trading returns a stable empty hydration snapshot independently of client trades", () => {
  let hydrating = true;
  const { usePaperTrading, openPaperTrade } = loadLibrary("paperTrading", {
    react: {
      useSyncExternalStore(_subscribe, getSnapshot, getServerSnapshot) {
        const read = hydrating ? getServerSnapshot : getSnapshot;
        const snapshot = read();
        assert.strictEqual(read(), snapshot);
        return snapshot;
      },
      useState: (initial) => [initial, () => {}],
      useEffect: () => {},
      useRef: (current) => ({ current }),
      useCallback: (callback) => callback,
    },
  });

  const initial = usePaperTrading().trades;
  assert.deepEqual(initial, []);
  const trade = openPaperTrade({ kode: "BBCA", nama: "Bank Central Asia", entryPrice: 9000 });
  assert.strictEqual(usePaperTrading().trades, initial);
  hydrating = false;
  assert.deepEqual(usePaperTrading().trades, [trade]);
});

test("paper trading starts empty and excludes only the built-in examples from saved history", (context) => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  context.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else delete globalThis.localStorage;
  });

  const storage = new Map();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener() {} } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } });
  assert.deepEqual(loadLibrary("paperTrading").getPaperTrades(), []);
  assert.equal(storage.has("investara_paper_trades"), false);

  const entryDate = new Date(2026, 10, 22, 12).toISOString();
  const trade = { id: "pt_manual_bbca", kode: "BBCA", entryDate, entryPrice: 10150, status: "OPEN" };
  storage.set("investara_paper_trades", JSON.stringify([
    { ...trade, id: "pt_seed_bbca", status: "TP2_HIT" },
    { ...trade, id: "pt_seed_tlkm", kode: "TLKM", status: "TP1_HIT" },
    trade,
  ]));
  const simulator = loadLibrary("paperTrading");
  assert.deepEqual(simulator.getPaperTrades(), [trade]);
  assert.deepEqual(simulator.getDailyPerformanceMap(simulator.getPaperTrades())["2026-11-22"].trades, [trade]);
});

test("paper trading closes the entire position at a confirmed target and realizes P/L once", () => {
  const { openPaperTrade, evaluateTradesWithLivePrices, calculateSummary, closePaperTrade, closeAllPaperTrades, savePaperTrades, getPaperTrades } = loadLibrary("paperTrading");
  const trades = ["BBCA", "BBRI", "BMRI", "TLKM", "ANTM", "ASII", "BBNI", "INCO"].map((kode) =>
    openPaperTrade({ kode, nama: kode, entryPrice: 1000, lot: 1 }),
  );
  const at = Date.parse(trades.at(-1).entryDate) + 60_000;
  const quotes = new Map([
    ["BBCA", { price: 1015, at }],
    ["BBRI", { price: 1050, at }],
    ["BMRI", { price: 970, at }],
    ["TLKM", { price: 1010, at }],
    ["ANTM", { price: NaN, at }],
    ["ASII", { price: 1050, at: Date.parse(trades[5].entryDate) - 1 }],
    ["BBNI", { price: 1050, at: at + 2000 }],
    ["INCO", { price: 1050 }],
  ]);
  const { updatedTrades, hasChanges, checked, closed } = evaluateTradesWithLivePrices(trades, quotes, at + 1000);

  assert.equal(hasChanges, true);
  assert.equal(checked, 4);
  assert.equal(closed, 3);
  assert.deepEqual(updatedTrades.map(({ status, exitPrice, realizedPnlRp }) => [status, exitPrice, realizedPnlRp]), [
    ["TP1_HIT", 1015, 1500], ["TP2_HIT", 1030, 3000], ["SL_HIT", 980, -2000],
    ["OPEN", undefined, undefined], ["OPEN", undefined, undefined],
    ["OPEN", undefined, undefined], ["OPEN", undefined, undefined], ["OPEN", undefined, undefined],
  ]);
  assert.ok(updatedTrades.slice(0, 3).every((trade) => Date.parse(trade.exitDate) === at && trade.unrealizedPnlRp === 0));
  assert.equal(updatedTrades[3].unrealizedPnlRp, 1000);
  assert.strictEqual(updatedTrades[4], trades[4]);
  const summary = calculateSummary(updatedTrades, 1_000_000);
  assert.equal(summary.closedTradesCount, 3);
  assert.equal(summary.availableCash, 502_500);

  const recheck = evaluateTradesWithLivePrices(updatedTrades, new Map([
    ["BBCA", { price: 1100, at }],
    ["TLKM", { price: 1100, at: at - 1000 }],
  ]), at);
  assert.equal(recheck.hasChanges, false);
  assert.strictEqual(recheck.updatedTrades[0], updatedTrades[0]);
  assert.strictEqual(recheck.updatedTrades[3], updatedTrades[3]);

  savePaperTrades(updatedTrades);
  const manual = closePaperTrade(trades[3].id);
  assert.equal(manual.status, "CLOSED");
  assert.equal(manual.exitPrice, 1010);
  assert.deepEqual(closeAllPaperTrades(), { count: 4, totalPnlRp: 0 });
  assert.ok(getPaperTrades().slice(3).every((trade) => trade.status === "CLOSED"));
});

test("paper trading rejects unfunded or invalid orders and prevents duplicate batch positions", () => {
  const paper = loadLibrary("paperTrading");
  paper.setStartingBalance(500_000);
  const order = { kode: "BBCA", nama: "Bank Central Asia", entryPrice: 1000, lot: 3 };
  assert.equal(paper.openPaperTrade({ ...order, lot: 6 }), null);
  assert.equal(paper.openPaperTrade({ ...order, lot: 1.5 }), null);
  assert.equal(paper.openPaperTrade({ ...order, stopLossPct: 2 }), null);
  assert.equal(paper.openPaperTrade({ ...order, targetTp1Pct: 4, targetTp2Pct: 3 }), null);
  assert.equal(paper.openBatchPaperTrades([order, order, { ...order, kode: "BBRI" }]), 1);
  assert.equal(paper.calculateSummary(paper.getPaperTrades(), 500_000).availableCash, 200_000);
  assert.equal(paper.openPaperTrade({ ...order, kode: "TLKM" }), null);
  assert.equal(paper.getPaperTrades().length, 1);
  const trade = paper.openPaperTrade({ ...order, kode: "TLKM", entryPrice: 2, lot: 1 });
  assert.deepEqual([trade.targetTp1, trade.targetTp2, trade.stopLoss], [3, 3, 1]);
});

test("the IDX universe retains its previous snapshot on outages and never substitutes a price move for CMF", async (context) => {
  let available = false;
  let now = Date.now();
  context.mock.method(Date, "now", () => now);
  class Yahoo {
    async quote() {
      if (!available) throw new Error("Provider unavailable");
      return [{ symbol: "BBCA.JK", regularMarketPrice: 1000, regularMarketVolume: 10000, regularMarketChangePercent: 10 }];
    }
  }
  const { getUniverse } = loadLibrary("market", {
    "yahoo-finance2": Yahoo, "./emiten.json": [{ kode: "BBCA", nama: "Bank Central Asia", papan: "Utama" }],
    "./tv": { getTv: async () => new Map() },
  });
  await assert.rejects(getUniverse(), /Kutipan saham belum tersedia/);
  available = true;
  const initial = await getUniverse();
  assert.equal(initial.items[0].foreign_flow, null);
  assert.equal(initial.items[0].foreign_status, null);
  now += 61_000;
  available = false;
  assert.deepEqual(await getUniverse(true), initial);
});

test("dividend schedules use the Jakarta calendar day and distinguish past ex-dates from scheduled ones", async (context) => {
  const date = Date.parse;
  context.mock.method(Date, "now", () => date("2026-11-23T17:30:00Z"));
  const row = { kode: "BBCA", nama: "BCA", harga: 1000, yield_pct: 3, bayar_akan: null, bayar_lalu: null };
  const marketDate = loadLibrary("marketDate");
  assert.equal(marketDate.nextMarketAnniversary(date("2024-02-29T00:00Z")), date("2025-02-28T00:00Z"));
  const { GET } = loadLibrary("../app/api/kalender/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/marketDate": marketDate,
    "@/lib/market": { getUniverse: async () => ({ items: [
      { ...row, ex_akan: date("2026-11-24T00:00Z"), ex_lalu: date("2026-11-22T00:00Z") },
      { ...row, kode: "BBRI", ex_akan: date("2026-11-23T08:00Z"), ex_lalu: null },
      { ...row, kode: "BMRI", ex_akan: date("2026-12-01T00:00Z"), ex_lalu: null },
    ], updatedAt: 123 }) },
  });
  const result = await (await GET({ nextUrl: new URL("http://localhost/api/kalender?hari=7") })).json();
  assert.deepEqual(result.items.map(({ kode, jenis }) => [kode, jenis]), [["BBCA", "lalu"], ["BBRI", "lalu"], ["BBCA", "pasti"], ["BMRI", "pasti"]]);
});

test("watchlist ignores another account's pending response and retries a failed read", async (context) => {
  let session = { status: "authenticated", data: { user: { id: "first" } } };
  let effect;
  const requests = [];
  context.mock.method(globalThis, "fetch", () => new Promise((resolve) => requests.push(resolve)));
  const { useWatchlist } = loadLibrary("../components/Watchlist.tsx", {
    "next-auth/react": { useSession: () => session },
    react: {
      useEffect(callback) { effect = callback; },
      useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
    },
  });
  useWatchlist();
  effect();
  session = { status: "authenticated", data: { user: { id: "second" } } };
  assert.deepEqual(useWatchlist().list, []);
  effect();
  requests[0](Response.json({ kodes: ["BBCA"] }));
  requests[1](new Response(null, { status: 502 }));
  await new Promise(setImmediate);
  assert.deepEqual(useWatchlist().list, []);
  assert.equal(useWatchlist().error, true);
  const retry = useWatchlist().reload();
  requests[2](Response.json({ kodes: ["BBRI"] }));
  await retry;
  assert.deepEqual(useWatchlist().list, ["BBRI"]);
  const changed = useWatchlist().toggle("TLKM");
  requests[3](new Response(null, { status: 500 }));
  assert.equal(await changed, false);
  assert.deepEqual(useWatchlist().list, ["BBRI"]);
});

test("news picks use recent issuer mentions, refresh the feeds and never invent quotes", async (context) => {
  const hour = 60 * 60 * 1000;
  let now = Date.now();
  let requests = 0;
  let failedFeeds = "none";
  const item = (title, slug, time) => `<item><title>${title} - Sumber uji</title><link>https://example.test/${slug}</link><pubDate>${new Date(time).toUTCString()}</pubDate><source>Sumber uji</source></item>`;
  let articles = [
    item("Dividen Bank Negara Indonesia", "expired", now - 73 * hour),
    item("Dividen saham BBCA", "older-duplicate", now - 6 * hour),
    item("Dividen saham BBCA", "newer", now - hour),
    item("Bi-rate NAIK, apa dampaknya?", "policy", now - 2 * hour),
    item("Dividen emiten (ZZZZ)", "unknown", now - 3 * hour),
  ];
  context.mock.method(Date, "now", () => now);
  context.mock.method(globalThis, "fetch", async (url) => {
    requests++;
    assert.match(new URL(url).searchParams.get("q"), /when:3d$/);
    if (failedFeeds === "all" || (failedFeeds === "some" && String(url).includes("minerba"))) {
      return new Response(null, { status: 503 });
    }
    return new Response(`<rss><channel>${articles.join("")}</channel></rss>`);
  });
  const { getDynamicNewsCatalysts } = loadLibrary("sentimentScanner", {
    "./market": {
      EMITEN: [
        { kode: "BBCA", nama: "Bank Central Asia Tbk." },
        { kode: "BBNI", nama: "Bank Negara Indonesia (Persero) Tbk." },
        { kode: "NAIK", nama: "Adiwarna Anugerah Abadi Tbk." },
      ],
      async getStockQuotes(codes) {
        return new Map(codes.filter((code) => code === "BBCA").map((code) => [code, { harga: 9000, perubahan_pct: -1 }]));
      },
    },
  });

  const initial = await getDynamicNewsCatalysts();
  assert.equal(initial.status, "ready");
  assert.deepEqual(initial.catalysts.map((group) => group.id), ["DIVIDEN", "BUNGA"]);
  assert.equal(initial.catalysts[0].article.url, "https://example.test/newer");
  assert.equal(initial.catalysts[0].article.sentiment, "NEUTRAL");
  assert.deepEqual(initial.catalysts[0].picks.map(({ kode, articleCount, harga }) => [kode, articleCount, harga]), [["BBCA", 1, 9000]]);
  assert.deepEqual(initial.catalysts[1].picks, []);
  const initialRequests = requests;
  assert.strictEqual(await getDynamicNewsCatalysts(true), initial);
  assert.equal(requests, initialRequests);

  now += 30_000;
  articles = [item("Dividen turun, Bank Negara Indonesia umumkan nominal baru", "replacement", now - 60_000)];
  failedFeeds = "some";
  const refresh = await getDynamicNewsCatalysts(true);
  assert.equal(refresh.status, "partial");
  assert.equal(refresh.updatedAt, new Date(now).toISOString());
  assert.equal(refresh.catalysts[0].article.sentiment, "BEARISH");
  assert.deepEqual(refresh.catalysts[0].picks.map(({ kode, harga }) => [kode, harga]), [["BBNI", null]]);
  assert.equal(refresh.picks[0].direction, "AVOID");

  now += 30_000;
  failedFeeds = "all";
  const unavailable = await getDynamicNewsCatalysts(true);
  assert.equal(unavailable.status, "unavailable");
  assert.deepEqual(unavailable.catalysts, []);
  assert.deepEqual(unavailable.picks, []);
});

test("news direction separates entry candidates from issuer risk and conflicting evidence", async () => {
  const ago = (minutes) => Date.now() - minutes * 60_000;
  const makeArticle = (judul, penerbit, minutes) => ({ judul, penerbit, url: `https://example.test/news/${minutes}`, publishedAt: ago(minutes) });
  const articles = [
    makeArticle("Saham BBCA laba bersih naik", "A", 5),
    makeArticle("Saham BBRI mengalami gagal bayar", "A", 10),
    makeArticle("Saham BBRI penjualan turun", "B", 15),
    makeArticle("Saham BBRI laba bersih naik", "C", 35),
    makeArticle("Emiten BBRI penjualan menurun setelah ekspansi", "B", 20),
    makeArticle("Saham BMRI pendapatan tumbuh", "A", 5.5),
    makeArticle("Saham BMRI laba turun", "B", 9),
    makeArticle("Saham ANTM penjualan tumbuh", "A", 7),
    makeArticle("Emiten TLKM penjualan meningkat", "A", 7.5),
    makeArticle("Dividen turun: saham BBNI dan (BBTN) dibahas", "A", 8),
    makeArticle("BI-Rate naik, dampaknya untuk saham BBNI", "B", 11),
    makeArticle("Saham BBNI bantah gagal bayar", "C", 12),
    makeArticle("Saham BBCA proyeksi laba turun", "C", 13),
  ];
  const quotes = new Map([
    ["BBCA", { harga: 9000, perubahan_pct: 2 }],
    ["BBRI", { harga: 3500, perubahan_pct: 1 }],
    ["ANTM", { harga: 2000, perubahan_pct: -1 }],
  ]);
  const { getDynamicNewsCatalysts } = loadLibrary("sentimentScanner", {
    "./news": { async readNewsFeed() { return articles; } },
    "./market": {
      EMITEN: ["BBCA", "BBRI", "BMRI", "ANTM", "TLKM", "BBNI", "BBTN"].map((kode) => ({ kode, nama: kode })),
      async getStockQuotes() { return quotes; },
    },
  });

  const { picks, catalysts } = await getDynamicNewsCatalysts();
  const byCode = new Map(picks.map((pick) => [pick.kode, pick]));
  assert.equal(byCode.get("BBCA").direction, "TAKE");
  assert.equal(byCode.get("BBRI").direction, "AVOID");
  assert.equal(byCode.get("BBRI").negativeSources, 2);
  assert.equal(byCode.get("BBRI").positiveSources, 1);
  assert.equal(byCode.get("BBRI").article.url, "https://example.test/news/10");
  for (const code of ["BMRI", "ANTM", "TLKM", "BBNI", "BBTN"]) assert.equal(byCode.get(code).direction, "WATCH");
  assert.equal(byCode.get("TLKM").harga, null);
  assert.equal(byCode.get("BBNI").negativeSources, 0);
  assert.equal(catalysts.find((group) => group.id === "BUNGA").picks[0].direction, "WATCH");
});

test("targeted news fills both directions with direct issuer evidence even when another feed fails", async () => {
  const article = (judul, minutes) => ({
    judul, penerbit: "Sumber uji", url: `https://example.test/radar/${minutes}`,
    publishedAt: Date.now() - minutes * 60_000,
  });
  const { getDynamicNewsCatalysts } = loadLibrary("sentimentScanner", {
    "./news": {
      async readNewsFeed(query) {
        if (query.includes('"dividen tunai"')) return [
          article("BCA Tebar Dividen Interim Rp 35 per Saham, Ini Jadwalnya", 5),
          article("MLBI Bagikan Dividen Interim Rp228 per Saham", 10),
          article("TMPO Bagikan Dividen Interim Non Tunai Rp10 per Saham", 11),
        ];
        if (query.includes('"gembok saham"')) return [
          article("BEI Suspensi Saham Bank SMBC (BTPN), Imbas Rencana Delisting", 12),
          article("BEI Suspensi Saham PSKT Dicabut", 13),
        ];
        if (query.includes("pertambangan")) throw new Error("Salah satu feed gagal");
        return [];
      },
    },
    "./market": {
      EMITEN: ["BBCA", "MLBI", "TMPO", "BTPN", "PSKT"].map((kode) => ({ kode, nama: kode })),
      async getStockQuotes() {
        return new Map([
          ["BBCA", { harga: 5700, perubahan_pct: 2 }],
          ["MLBI", { harga: 6600, perubahan_pct: -2 }],
          ["TMPO", { harga: 238, perubahan_pct: 2 }],
        ]);
      },
    },
  });
  const result = await getDynamicNewsCatalysts();
  assert.equal(result.status, "partial");
  assert.deepEqual(result.picks.map(({ kode, direction }) => [kode, direction]), [
    ["BBCA", "TAKE"], ["BTPN", "AVOID"], ["MLBI", "WATCH"], ["TMPO", "WATCH"], ["PSKT", "WATCH"],
  ]);
  assert.equal(result.picks[1].harga, null);
  assert.equal(Object.hasOwn(result.picks[1], "projection"), false);
  assert.deepEqual(result.picks[0].projection, { tp1: 5800, tp2: 5875, downside: 5575 });
});

test("news Radar retains multiple qualifying issuers and projects valid price ticks only for entry candidates", async () => {
  const positive = ["BBCA", "BBNI", "BBRI", "ASII", "BMRI", "AMRT", "TLKM", "KLBF"];
  const negative = ["AVIA", "ADRO", "ANTM", "BREN", "ITMG", "INCO", "BRIS", "PGAS"];
  const articles = [
    ...positive.map((kode) => [kode, `Laba Bersih ${kode} Naik 15 Persen`]),
    ...negative.map((kode) => [kode, `Pendapatan ${kode} Turun 12 Persen`]),
  ].map(([kode, judul]) => ({
    judul, penerbit: "Media Uji", url: `https://example.test/${kode}`, publishedAt: Date.now() - 60_000,
  }));
  const { getDynamicNewsCatalysts } = loadLibrary("sentimentScanner", {
    "./news": { async readNewsFeed(_query, _edition, _force, limit) { return articles.slice(0, limit); } },
    "./market": {
      EMITEN: [...positive, ...negative].map((kode) => ({ kode, nama: kode })),
      async getStockQuotes(codes) {
        return new Map(codes.map((kode) => [kode, { harga: 499, perubahan_pct: positive.includes(kode) ? 1 : -1 }]));
      },
    },
  });
  const { picks, catalysts } = await getDynamicNewsCatalysts();
  for (const group of [picks, catalysts.find(({ id }) => id === "EMITEN").picks]) {
    const take = group.filter(({ direction }) => direction === "TAKE");
    const avoid = group.filter(({ direction }) => direction === "AVOID");
    assert.equal(take.length, positive.length);
    assert.equal(avoid.length, negative.length);
    assert.ok(take.every(({ projection }) => projection.tp1 === 510 && projection.tp2 === 515 && projection.downside === 488));
    assert.ok(avoid.every((pick) => !Object.hasOwn(pick, "projection")));
  }
});

test("sector news watches only mapped industries and keeps direct issuer risk", async (context) => {
  let now = Date.now();
  context.mock.method(Date, "now", () => now);
  const article = (judul, minutes) => ({
    judul, penerbit: "Sumber uji", url: `https://example.test/sector/${minutes}`, publishedAt: now - minutes * 60_000,
  });
  const articles = [
    article("Harga batu bara anjlok", 4),
    article("Saham PTBA gagal bayar", 5),
    article("Pendapatan turun di sektor pertambangan, saham ANTM ikut disorot", 8),
    article("Sektor perbankan menghadapi tekanan biaya", 10),
    article("Sektor pertambangan emas menguat", 12),
  ];
  const info = (sektor, industri, nilai) => ({ sektor, industri, nilai });
  const market = new Map([
    ["ITMG", info("Energi", "Coal", 100)],
    ["PTBA", info("Energi", "Coal", 50)],
    ["ANTM", info("Barang Baku", "Other Metals/Minerals", 60)],
    ["BRMS", info("Barang Baku", "Precious Metals", 20)],
    ["SMGR", info("Barang Baku", "Construction Materials", 500)],
    ["BBCA", info("Keuangan", "Major Banks", 400)],
    ["ZZZZ", info("Energi", "Coal", 1000)],
  ]);
  let marketAvailable = true;
  const { getDynamicNewsCatalysts } = loadLibrary("sentimentScanner", {
    "./news": { async readNewsFeed() { return articles; } },
    "./tv": { async getTv() { return marketAvailable ? market : new Map(); } },
    "./market": {
      EMITEN: ["ITMG", "PTBA", "ANTM", "BRMS", "SMGR", "BBCA"].map((kode) => ({ kode, nama: kode })),
      async getStockQuotes() { return new Map(); },
    },
  });

  const scan = await getDynamicNewsCatalysts();
  const coal = scan.sectors.find((group) => group.id === "sector-coal");
  assert.deepEqual(coal.picks.map(({ kode, direction }) => [kode, direction]), [["ITMG", "WATCH"], ["PTBA", "AVOID"]]);
  assert.equal(coal.picks[0].article.url, "https://example.test/sector/4");
  assert.equal(coal.picks[0].sectorOnly, true);
  assert.match(coal.picks[0].reason, /Waspadai/);
  assert.equal(coal.picks[1].article.url, "https://example.test/sector/5");
  const mining = scan.sectors.find((group) => group.id === "sector-mining");
  assert.deepEqual(mining.picks.map(({ kode }) => kode), ["ITMG", "ANTM", "PTBA", "BRMS"]);
  const gold = scan.sectors.find((group) => group.id === "sector-gold");
  assert.deepEqual(gold.picks.map(({ kode }) => kode), ["BRMS"]);
  assert.match(gold.picks[0].reason, /^Pantau/);
  assert.equal(scan.picks.find((pick) => pick.kode === "ANTM").direction, "WATCH");
  assert.equal(scan.picks.find((pick) => pick.kode === "ANTM").negativeSources, 0);
  assert.deepEqual(scan.sectors.find((group) => group.id === "sector-banks").picks.map(({ kode }) => kode), ["BBCA"]);
  assert.equal(new Set(scan.picks.map((pick) => pick.kode)).size, scan.picks.length);

  now += 30_000;
  marketAvailable = false;
  const unavailable = await getDynamicNewsCatalysts(true);
  assert.ok(unavailable.sectors.length > 0);
  assert.ok(unavailable.sectors.every((group) => group.picks.length === 0));
});

test("crypto uses real quotes and retains their timestamps when upstream feeds fail", async (context) => {
  const start = Date.now();
  let now = start;
  let upstreamAvailable = true;
  let yahooRecovered = false;
  context.mock.method(Date, "now", () => now);
  context.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (!upstreamAvailable) return new Response(null, { status: 503 });
    if (url.origin === "https://data-api.binance.vision" && url.pathname === "/api/v3/ticker/24hr") {
      const tickers = [
        { symbol: "BTCUSDT", lastPrice: "100", priceChangePercent: "-2", quoteVolume: "400000", closeTime: start },
        { symbol: "TESTUSDT", lastPrice: "2", priceChangePercent: "16", quoteVolume: "200000", closeTime: start },
      ];
      const symbol = url.searchParams.get("symbol");
      if (symbol === "TSTXUSDT") return Response.json({ ...tickers[1], symbol });
      return Response.json(tickers);
    }
    throw new Error("Unexpected upstream request");
  });
  class Yahoo {
    async quote() {
      return yahooRecovered ? [{ symbol: "ETH-USD", regularMarketPrice: 42, regularMarketTime: new Date(now) }] : [];
    }
    async chart() { return { quotes: [] }; }
  }
  const { getCryptoUniverse, getCryptoDetail, getCryptoMarketItem, getLiveFearAndGreed } = loadLibrary("crypto", { "yahoo-finance2": Yahoo });
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
  assert.equal((await getCryptoMarketItem("TSTX")).price_usd, 2);
  now += 20_000;
  upstreamAvailable = false;
  const stale = await getCryptoUniverse();
  assert.equal(stale.updatedAt, start);
  assert.ok(stale.items.every((item) => item.stale));
  now += 20_000;
  yahooRecovered = true;
  const recovered = await getCryptoUniverse();
  assert.equal(recovered.items.find((item) => item.symbol === "ETH").quoteSource, "Yahoo Finance");
  assert.equal(recovered.updatedAt, now);
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
