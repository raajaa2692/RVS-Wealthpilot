# RVS WealthPilot V14 — Public Launch Data Platform

This build adds a production-oriented AMFI data pipeline:

AMFI NAV → normalized PostgreSQL fund database → daily NAV observations → daily analytics snapshots → research score API.

## Production setup

1. Create a managed PostgreSQL database (for example Neon, Supabase Postgres, or another PostgreSQL provider).
2. Set `DATABASE_URL` in Vercel Project Settings → Environment Variables.
3. Set a strong `CRON_SECRET` in Vercel Environment Variables.
4. Install dependencies and run `npm run db:migrate` once against the production database.
5. Deploy to Vercel. The daily cron calls `/api/ingest/amfi` at 03:15 UTC.

## What is stored

- `fund_schemes`: normalized scheme identity and official disclosure fields.
- `nav_observations`: one NAV observation per scheme/date.
- `fund_analytics_daily`: daily return, available CAGR windows, disclosure fields and research score snapshot.
- `ingestion_runs`: operational audit trail.
- `disclosure_ingestion_runs`: reserved for monthly official disclosure ingestion/backfills.

## Important launch behavior

AMFI's historical NAV endpoint limits a single historical request to 90 days. The daily pipeline therefore builds a reliable time-series going forward rather than pretending that a brand-new database already has ten years of validated history. A separate historical backfill job should be run for priority schemes if long-term analytics are required on day one.

Benchmark, Risk-o-meter and TER remain nullable until a scheme-level official disclosure match is validated. Never manufacture those fields.

The research score is a transparent research signal, not financial advice, a forecast, or a guarantee.

## Vercel launch checklist

- Framework: Next.js; Root: `./`; Build: `next build`; Output Directory: leave default.
- Add `DATABASE_URL` and `CRON_SECRET` to Production environment variables.
- Run `npm install` and `npm run db:migrate` once locally or from a secure CI runner using the production database URL.
- Deploy to Vercel and confirm the first `/api/ingest/amfi` cron run succeeds.
- Check `/api/production-health` and database tables after ingestion.

## Data lifecycle

1. **Ingestion:** AMFI's latest NAV text is downloaded once per scheduled run.
2. **Normalization:** scheme identity is keyed by `(scheme_code, ISIN)` and category is normalized for research use.
3. **Observation:** each scheme/date NAV is stored idempotently.
4. **Snapshot:** daily return and available long-term CAGR windows are materialized in `fund_analytics_daily`.
5. **Scoring:** a transparent research score is calculated from available validated metrics; confidence is stored with the score.
6. **Serving:** Fund Research, the dashboard ticker and scoring API read from PostgreSQL, with a bootstrap fallback to AMFI if the database has not yet been seeded.

## Long-term history

AMFI currently limits a single historical NAV request to 90 days. The schema is designed for a separate priority-scheme backfill worker. Do not claim 5Y/7Y/10Y analytics for a scheme until sufficient historical observations or another validated official source exists.
