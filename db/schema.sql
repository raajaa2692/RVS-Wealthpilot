CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS fund_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_code text NOT NULL,
  isin text NOT NULL DEFAULT '',
  isin_reinvestment text NOT NULL DEFAULT '',
  scheme_name text NOT NULL,
  amc text,
  category text,
  benchmark_name text,
  riskometer text,
  ter_direct numeric(8,4),
  ter_regular numeric(8,4),
  factsheet_url text,
  riskometer_url text,
  ter_source_url text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scheme_code, isin)
);
CREATE INDEX IF NOT EXISTS idx_fund_schemes_name ON fund_schemes USING gin (to_tsvector('simple', scheme_name));
CREATE INDEX IF NOT EXISTS idx_fund_schemes_amc_category ON fund_schemes(amc, category);

CREATE TABLE IF NOT EXISTS nav_observations (
  id bigserial PRIMARY KEY,
  scheme_code text NOT NULL,
  isin text NOT NULL DEFAULT '',
  nav numeric(18,6) NOT NULL,
  nav_date date NOT NULL,
  source text NOT NULL,
  ingestion_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scheme_code, isin, nav_date)
);
CREATE INDEX IF NOT EXISTS idx_nav_scheme_date ON nav_observations(scheme_code, nav_date DESC);

CREATE TABLE IF NOT EXISTS fund_analytics_daily (
  id bigserial PRIMARY KEY,
  scheme_code text NOT NULL,
  isin text NOT NULL DEFAULT '',
  snapshot_date date NOT NULL,
  nav numeric(18,6),
  previous_nav numeric(18,6),
  daily_return_pct numeric(12,6),
  cagr_5y numeric(12,6),
  cagr_7y numeric(12,6),
  cagr_10y numeric(12,6),
  benchmark_name text,
  riskometer text,
  ter_direct numeric(8,4),
  ter_regular numeric(8,4),
  score numeric(8,3),
  score_confidence text,
  data_coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'RVS_ANALYTICS',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scheme_code, isin, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_analytics_date_score ON fund_analytics_daily(snapshot_date DESC, score DESC);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  records_seen integer DEFAULT 0,
  records_upserted integer DEFAULT 0,
  error_message text
);

CREATE TABLE IF NOT EXISTS disclosure_ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL,
  snapshot_month date,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  records_upserted integer DEFAULT 0,
  error_message text
);

CREATE OR REPLACE VIEW latest_fund_analytics AS
SELECT DISTINCT ON (a.scheme_code, a.isin)
  a.*, f.scheme_name, f.amc, f.category
FROM fund_analytics_daily a
JOIN fund_schemes f ON f.scheme_code=a.scheme_code AND f.isin=a.isin
ORDER BY a.scheme_code, a.isin, a.snapshot_date DESC;
