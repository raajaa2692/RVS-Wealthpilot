import { query } from '@/lib/db'

type SnapshotOptions = {
  snapshotDate?: string
  limit?: number
  offset?: number
}

type SchemeRow = {
  scheme_code: string
  isin: string
  benchmark_name: string | null
  riskometer: string | null
  ter_direct: number | null
  ter_regular: number | null
  nav: number
  nav_date: string
  previous_nav: number | null
  nav_5y: number | null
  date_5y: string | null
  nav_7y: number | null
  date_7y: string | null
  nav_10y: number | null
  date_10y: string | null
}

export async function snapshotAnalytics(options: SnapshotOptions = {}) {
  const snapshotDate = options.snapshotDate || new Date().toISOString().slice(0, 10)
  const limit = Math.max(1, Math.min(options.limit ?? 2000, 2000))
  const offset = Math.max(0, options.offset ?? 0)

  // One SQL read gets the latest/previous NAV and the nearest historical NAV
  // for each scheme in this batch. This avoids fetching 4,000 rows per scheme.
  const schemes = await query<SchemeRow>(
    `
    SELECT
      f.scheme_code,
      f.isin,
      f.benchmark_name,
      f.riskometer,
      f.ter_direct,
      f.ter_regular,
      latest.nav,
      latest.nav_date,
      previous.nav AS previous_nav,
      y5.nav AS nav_5y,
      y5.nav_date AS date_5y,
      y7.nav AS nav_7y,
      y7.nav_date AS date_7y,
      y10.nav AS nav_10y,
      y10.nav_date AS date_10y
    FROM fund_schemes f
    JOIN LATERAL (
      SELECT nav, nav_date
      FROM nav_observations n
      WHERE n.scheme_code = f.scheme_code
        AND n.isin = f.isin
      ORDER BY nav_date DESC
      LIMIT 1
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT nav
      FROM nav_observations n
      WHERE n.scheme_code = f.scheme_code
        AND n.isin = f.isin
        AND n.nav_date < latest.nav_date
      ORDER BY nav_date DESC
      LIMIT 1
    ) previous ON true
    LEFT JOIN LATERAL (
      SELECT nav, nav_date
      FROM nav_observations n
      WHERE n.scheme_code = f.scheme_code
        AND n.isin = f.isin
        AND n.nav_date BETWEEN (latest.nav_date - INTERVAL '5 years' - INTERVAL '10 days')::date
                           AND (latest.nav_date - INTERVAL '5 years' + INTERVAL '10 days')::date
      ORDER BY ABS(n.nav_date - (latest.nav_date - INTERVAL '5 years')::date)
      LIMIT 1
    ) y5 ON true
    LEFT JOIN LATERAL (
      SELECT nav, nav_date
      FROM nav_observations n
      WHERE n.scheme_code = f.scheme_code
        AND n.isin = f.isin
        AND n.nav_date BETWEEN (latest.nav_date - INTERVAL '7 years' - INTERVAL '10 days')::date
                           AND (latest.nav_date - INTERVAL '7 years' + INTERVAL '10 days')::date
      ORDER BY ABS(n.nav_date - (latest.nav_date - INTERVAL '7 years')::date)
      LIMIT 1
    ) y7 ON true
    LEFT JOIN LATERAL (
      SELECT nav, nav_date
      FROM nav_observations n
      WHERE n.scheme_code = f.scheme_code
        AND n.isin = f.isin
        AND n.nav_date BETWEEN (latest.nav_date - INTERVAL '10 years' - INTERVAL '10 days')::date
                           AND (latest.nav_date - INTERVAL '10 years' + INTERVAL '10 days')::date
      ORDER BY ABS(n.nav_date - (latest.nav_date - INTERVAL '10 years')::date)
      LIMIT 1
    ) y10 ON true
    WHERE f.last_seen_at >= now() - INTERVAL '7 days'
    ORDER BY f.scheme_code, f.isin
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  )

  if (!schemes.rows.length) {
    return {
      snapshotDate,
      offset,
      limit,
      schemes: 0,
      written: 0,
      done: true
    }
  }

  const records = schemes.rows.map((s) => {
    const latestDate = new Date(s.nav_date)

    const cagr = (historicalNav: number | null, historicalDate: string | null, years: number) => {
      if (historicalNav == null || !historicalDate) return null
      const historicalDateMs = new Date(historicalDate).getTime()
      const target = new Date(latestDate)
      target.setUTCFullYear(target.getUTCFullYear() - years)
      const diff = Math.abs(historicalDateMs - target.getTime())
      if (diff > 10 * 24 * 60 * 60 * 1000) return null
      const start = Number(historicalNav)
      const end = Number(s.nav)
      if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(end) || end <= 0) return null
      return (Math.pow(end / start, 1 / years) - 1) * 100
    }

    const daily = s.previous_nav == null
      ? null
      : ((Number(s.nav) - Number(s.previous_nav)) / Number(s.previous_nav)) * 100

    const cagr5 = cagr(s.nav_5y, s.date_5y, 5)
    const cagr7 = cagr(s.nav_7y, s.date_7y, 7)
    const cagr10 = cagr(s.nav_10y, s.date_10y, 10)

    const score = researchScore({
      cagr5,
      cagr7,
      cagr10,
      ter: s.ter_direct,
      risk: s.riskometer
    })

    const coverage = {
      daily: daily !== null,
      cagr5: cagr5 !== null,
      cagr7: cagr7 !== null,
      cagr10: cagr10 !== null,
      benchmark: !!s.benchmark_name,
      riskometer: !!s.riskometer,
      ter: s.ter_direct !== null
    }

    return [
      s.scheme_code,
      s.isin,
      snapshotDate,
      s.nav,
      s.previous_nav,
      daily,
      cagr5,
      cagr7,
      cagr10,
      s.benchmark_name,
      s.riskometer,
      s.ter_direct,
      s.ter_regular,
      score.score,
      score.confidence,
      JSON.stringify(coverage)
    ]
  })

  const columns = [
    'scheme_code', 'isin', 'snapshot_date', 'nav', 'previous_nav',
    'daily_return_pct', 'cagr_5y', 'cagr_7y', 'cagr_10y',
    'benchmark_name', 'riskometer', 'ter_direct', 'ter_regular',
    'score', 'score_confidence', 'data_coverage'
  ]

  const arrays = columns.map((_, index) => records.map((row) => row[index]))

  await query(
    `
    INSERT INTO fund_analytics_daily
      (scheme_code, isin, snapshot_date, nav, previous_nav, daily_return_pct,
       cagr_5y, cagr_7y, cagr_10y, benchmark_name, riskometer, ter_direct,
       ter_regular, score, score_confidence, data_coverage)
    SELECT * FROM unnest(
      $1::text[], $2::text[], $3::date[], $4::numeric[], $5::numeric[],
      $6::numeric[], $7::numeric[], $8::numeric[], $9::numeric[],
      $10::text[], $11::text[], $12::numeric[], $13::numeric[],
      $14::numeric[], $15::text[], $16::jsonb[]
    )
    ON CONFLICT (scheme_code, isin, snapshot_date) DO UPDATE SET
      nav = EXCLUDED.nav,
      previous_nav = EXCLUDED.previous_nav,
      daily_return_pct = EXCLUDED.daily_return_pct,
      cagr_5y = EXCLUDED.cagr_5y,
      cagr_7y = EXCLUDED.cagr_7y,
      cagr_10y = EXCLUDED.cagr_10y,
      benchmark_name = EXCLUDED.benchmark_name,
      riskometer = EXCLUDED.riskometer,
      ter_direct = EXCLUDED.ter_direct,
      ter_regular = EXCLUDED.ter_regular,
      score = EXCLUDED.score,
      score_confidence = EXCLUDED.score_confidence,
      data_coverage = EXCLUDED.data_coverage
    `,
    arrays
  )

  return {
    snapshotDate,
    offset,
    limit,
    schemes: schemes.rows.length,
    written: records.length,
    done: schemes.rows.length < limit,
    nextOffset: schemes.rows.length < limit ? null : offset + schemes.rows.length
  }
}

export function researchScore(x: {
  cagr5: number | null
  cagr7: number | null
  cagr10: number | null
  ter: number | null | undefined
  risk: string | null | undefined
}) {
  const values = [x.cagr5, x.cagr7, x.cagr10]
    .filter((v) => typeof v === 'number' && Number.isFinite(v)) as number[]

  let score = 50

  if (values.length) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    score += Math.max(-15, Math.min(25, avg * 1.4))
  }

  if (typeof x.ter === 'number' && Number.isFinite(x.ter)) {
    score += Math.max(-8, Math.min(8, (1.5 - x.ter) * 5))
  }

  if (x.risk) {
    const r = x.risk.toLowerCase()
    if (r.includes('very high')) score -= 3
    else if (r.includes('high')) score -= 1
  }

  const confidence =
    values.length >= 3 && x.ter !== null && x.ter !== undefined
      ? 'High'
      : values.length >= 2
        ? 'Medium'
        : 'Low'

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    confidence
  }
}
