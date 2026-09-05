import { query } from './db'

const AMFI_HISTORY =
  'https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx'

type Scheme = {
  scheme_code: string
  isin: string
  latest_nav_date: string
}

type HistoricalNav = {
  schemeCode: string
  isin: string
  nav: number
  navDate: string
}

function parseAmfiDate(value: string) {
  const m = value.trim().match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})$/)
  if (!m) return null

  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3,
    May: 4, Jun: 5, Jul: 6, Aug: 7,
    Sep: 8, Oct: 9, Nov: 10, Dec: 11
  }

  const month = months[m[2].slice(0, 3)]
  if (month === undefined) return null

  return new Date(Date.UTC(
    Number(m[3]),
    month,
    Number(m[1])
  ))
}

function formatAmfiDate(date: Date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]

  return `${String(date.getUTCDate()).padStart(2, '0')}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()}`
}

function differenceInDays(a: Date, b: Date) {
  return Math.abs(
    Math.round(
      (a.getTime() - b.getTime()) /
      (24 * 60 * 60 * 1000)
    )
  )
}

function subtractYears(date: Date, years: number) {
  const result = new Date(date)
  result.setUTCFullYear(result.getUTCFullYear() - years)
  return result
}

function parseHistory(
  text: string,
  wanted: Set<string>
) {
  const rows: HistoricalNav[] = []

  for (const raw of text.split(/\r?\n/)) {
    const p = raw.trim().split(';').map(x => x.trim())

    if (
      p.length >= 8 &&
      /^\d+$/.test(p[0]) &&
      wanted.has(`${p[0]}|${p[4]}`)
    ) {
      const nav = Number(p[6])
      const navDate = p[7]

      if (!Number.isFinite(nav) || nav <= 0 || !navDate) {
        continue
      }

      rows.push({
        schemeCode: p[0],
        isin: p[4],
        nav,
        navDate
      })
    }
  }

  return rows
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 60000
) {
  const controller = new AbortController()

  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  )

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RVS-WealthPilot/17.0'
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function loadHistoricalAnchors(options: {
  limit?: number
  offset?: number
} = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500))
  const offset = Math.max(0, options.offset ?? 0)

  const schemesResult = await query<Scheme>(
    `
    SELECT
      f.scheme_code,
      f.isin,
      latest.nav_date AS latest_nav_date
    FROM fund_schemes f
    JOIN LATERAL (
      SELECT nav_date
      FROM nav_observations n
      WHERE n.scheme_code = f.scheme_code
        AND n.isin = f.isin
      ORDER BY nav_date DESC
      LIMIT 1
    ) latest ON true
    ORDER BY f.scheme_code, f.isin
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  )

  const schemes = schemesResult.rows

  if (!schemes.length) {
    return {
      schemes: 0,
      rowsFound: 0,
      anchorsWritten: 0,
      done: true,
      nextOffset: null
    }
  }

  const wanted = new Set(
    schemes.map(s => `${s.scheme_code}|${s.isin}`)
  )

  const best = new Map<string, {
    schemeCode: string
    isin: string
    years: number
    nav: number
    navDate: string
    distanceDays: number
  }>()

  for (const years of [5, 7, 10]) {
    /*
     * IMPORTANT:
     * AMFI request window is based on today's calendar date,
     * not the earliest/latest fund target date.
     *
     * This prevents accidentally requesting several years
     * of AMFI history when a batch contains mixed fund dates.
     */
    const today = new Date()

    const target = new Date(today)
    target.setUTCHours(0, 0, 0, 0)
    target.setUTCFullYear(
      target.getUTCFullYear() - years
    )

    const from = new Date(target)
    from.setUTCDate(from.getUTCDate() - 10)

    const to = new Date(target)
    to.setUTCDate(to.getUTCDate() + 10)

    const url =
      `${AMFI_HISTORY}?frmdt=${encodeURIComponent(formatAmfiDate(from))}` +
      `&todt=${encodeURIComponent(formatAmfiDate(to))}`

    console.log(
      `${years}Y: requesting ${formatAmfiDate(from)} to ${formatAmfiDate(to)}`
    )

    let response: Response

    try {
      response = await fetchWithTimeout(url)
    } catch (error) {
      console.error(
        `${years}Y: AMFI request failed`,
        error
      )
      continue
    }

    if (!response.ok) {
      console.error(
        `${years}Y: AMFI HTTP ${response.status}`
      )
      continue
    }

    const rows = parseHistory(
      await response.text(),
      wanted
    )

    console.log(
      `${years}Y: matching NAV rows ${rows.length}`
    )

    for (const row of rows) {
      const scheme = schemes.find(
        s =>
          s.scheme_code === row.schemeCode &&
          s.isin === row.isin
      )

      if (!scheme) continue

      const latestDate = new Date(
        scheme.latest_nav_date
      )

      const fundTarget = subtractYears(
        latestDate,
        years
      )

      const date = parseAmfiDate(row.navDate)

      if (!date) continue

      const distanceDays = differenceInDays(
        date,
        fundTarget
      )

      if (distanceDays > 10) continue

      const anchorKey =
        `${row.schemeCode}|${row.isin}|${years}`

      const existing = best.get(anchorKey)

      if (
        !existing ||
        distanceDays < existing.distanceDays
      ) {
        best.set(anchorKey, {
          schemeCode: row.schemeCode,
          isin: row.isin,
          years,
          nav: row.nav,
          navDate: date.toISOString().slice(0, 10),
          distanceDays
        })
      }
    }
  }

  const rows = Array.from(best.values())

  let anchorsWritten = 0

  if (rows.length) {
    const schemeCodes = rows.map(r => r.schemeCode)
    const isins = rows.map(r => r.isin)
    const years = rows.map(r => r.years)
    const dates = rows.map(r => r.navDate)
    const navs = rows.map(r => r.nav)

    const result = await query(
      `
      INSERT INTO nav_history_anchors
        (
          scheme_code,
          isin,
          anchor_years,
          anchor_date,
          nav
        )
      SELECT
        scheme_code,
        isin,
        anchor_years,
        anchor_date,
        nav
      FROM unnest(
        $1::text[],
        $2::text[],
        $3::smallint[],
        $4::date[],
        $5::numeric[]
      )
      AS t(
        scheme_code,
        isin,
        anchor_years,
        anchor_date,
        nav
      )
      ON CONFLICT (
        scheme_code,
        isin,
        anchor_years
      )
      DO UPDATE SET
        anchor_date = EXCLUDED.anchor_date,
        nav = EXCLUDED.nav,
        updated_at = now()
      `,
      [
        schemeCodes,
        isins,
        years,
        dates,
        navs
      ]
    )

    anchorsWritten = result.rowCount ?? 0
  }

  return {
    schemes: schemes.length,
    rowsFound: rows.length,
    anchorsWritten,
    done: schemes.length < limit,
    nextOffset:
      schemes.length < limit
        ? null
        : offset + schemes.length
  }
}