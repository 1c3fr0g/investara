# Investara

Investara combines an IDX screener, investment shortlist, market and macro dashboards, a dividend calendar, crypto research, watchlists, alerts, portfolio tracking, and paper trading.

## Local development

Use Node.js 24 and run these commands from the web repository.

```sh
npm ci
npm run dev
npm test
npm run build
```

Copy the variable names from [.env.example](.env.example) into your local configuration. Set the Auth.js secret for sign-in, optional OAuth credentials for the login providers you use, and optional Gemini credentials for the AI analyst.

### Bandarmology and Insider

Stock details show a 20-session Chaikin Money Flow indicator from historical prices, the available Yahoo Finance insider ownership snapshot, and links to BEI. Past-session CMF describes price and volume pressure. It cannot identify a broker or investor.

Configure the optional server-only `INVEZGO_API_KEY` locally or in Vercel for automatic [net stock broker summaries](https://docs.invezgo.com/en/api-usage/endpoint/broker-flow/summary-stock/) and [insider disclosures](https://docs.invezgo.com/en/api-usage/endpoint/shareholder/shareholder-insider/). Use a plan that covers both endpoints and permits your intended display of the data. Without access, Investara can show gross broker volume from IPOT via [Midori Research](https://ihsg.midoriresearch.com/docs/json-output), a dated single-session foreign flow snapshot if available, and manually verified [BEI ownership disclosures](https://www.idx.co.id/id/berita/pengumuman/). The verified archive currently covers ANTM. Each archived report links to the original filing.

## Market data and news

Crypto prices come from Binance Spot in USDT or Yahoo Finance in USD. The list labels each quote with its provider and available timestamp. IDR uses a fixed reference rate of Rp15.850. Market-cap totals and BTC share cover assets with Yahoo Finance capitalization data. A missing value appears as a dash, and the market-cap ranking excludes missing and stale values. Crypto technical indicators and historical simulations use daily Yahoo Finance prices.

Macro quotes keep the original provider timestamp when the app serves a saved quote during an outage. News uses publication timestamps and article-level links supplied by the feed.

## Portfolio

New trades recorded in Investara update the portfolio and transaction log together. Sales consume the oldest available lots first. Deleting a linked transaction recalculates the remaining holdings. If that would leave a later sale without enough lots, correct the sale first. Existing holdings enter the calculation as opening positions, and older log entries remain visible as history.

## Offline paper trading

Sign in from the browser that holds your paper positions, open Simulasi, and activate **Pantau offline**. Wait for **Tersinkron** after activating or opening a position. The server stores the target prices and simulated exits. The simulation history and starting balance stay in the browser, which imports server results when you return.

Vercel Schedules checks paper positions every 15 minutes, from 09:00 through 16:45 WIB on weekdays, using `CRON_SECRET`. The final checks cover the regular market's post-closing session. Hobby can start each run within a 15-minute window after the scheduled time. The 32 weekday checks use up to 736 scheduled runs in a 31-day month, out of the team's 5,000-run allowance. [Vercel Schedules limits](https://vercel.com/docs/schedules/limits)

The sweep checks completed Yahoo Finance five-minute candles from the past seven days. The first completed candle starting after registration can count. A target reached within a candle closes the whole position at the configured level. If TP and SL are both touched and the opening price does not establish which was reached first, SL takes priority. The timestamp shown is the end of the matching candle. Missing candles can leave a position open until data is available. Each sweep checks up to 40 ticker symbols, prioritizing those checked least recently.

To trigger the same sweep on a standalone deployment, send GET `/api/internal/simulasi/sweep` with `Authorization: Bearer <CRON_SECRET>` from a scheduler.

## Free hosting on Vercel

Vercel Hobby hosts the Next.js app for personal, non-commercial use. Turso Free stores accounts, portfolios, watchlists, screeners, and alert state. [Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Turso Free](https://turso.tech/pricing)

1. Create a libSQL database on Turso Cloud and generate a database-scoped read/write token. With the Turso CLI, use `turso db create investara`, `turso db show investara --url`, and `turso db tokens create investara`. [Turso quickstart](https://docs.turso.tech/quickstart)
2. Create a Vercel Hobby project using Next.js and Node.js 24. Import the Git repository or use `npx vercel link` from `web` to deploy directly from this folder. For a Git repository that contains the workspace, set the Vercel root directory to `web`. The [Vercel configuration](vercel.json) runs server functions in Singapore, the region of the Investara Turso database.
3. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`, and `CRON_SECRET` for Production. Generate the two secrets independently, for example with `openssl rand -hex 32`. Optional OAuth, Gemini, and Web Push settings are listed in [.env.example](.env.example). Configure OAuth callback URLs for the production domain if you enable OAuth.
4. Deploy in Vercel or run `npx vercel deploy --prod` from `web`. Verify sign-in, a saved watchlist entry, and the scheduled job in the Vercel project. The app creates the schema on first use. A new hosted database starts empty. Keep a backup of `data/app.db` if you plan to import data from local development.

### Alert scheduling

The included cron runs on weekdays during the 16:00 WIB hour. Vercel Hobby can start the job at any point in that hour. For more frequent scans, a separate scheduler can send a GET request to `/api/internal/alerts/sweep` with `Authorization: Bearer <CRON_SECRET>`. Keep the secret in the scheduler’s private settings. [Vercel cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing)

- Create saved screeners from the filter panel. The monitor records the initial match set, then adds newly matching stocks and price-target crossings to the alert inbox.
- Set ALERT_PUSH_SUBJECT to a public contact email with a mailto: prefix or an HTTPS URL. Use HTTPS for production push notifications and enable notifications on each device from the Alert page.
- CI runs the production build and regression tests for provider outages, portfolio changes, and chat request limits. The in-process chat quota applies independently to each server process.

On a continuously running Node.js server, Investara can use local SQLite at `data/app.db` and run its background monitor in one process. Set `ALERT_MONITOR_ENABLED=0` to disable alert scans. Back up the database with SQLite’s backup tooling.

For the standalone Streamlit prototype, install the Python dependencies from requirements.txt at the workspace root and run streamlit run main.py there.
