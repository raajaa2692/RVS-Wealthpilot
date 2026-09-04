export const AMFI_NAV_URL = 'https://portal.amfiindia.com/spages/NAVAll.txt'

type RawFund = { schemeCode:string; isin:string; isinReinvestment:string; schemeName:string; nav:number; navDate:string; amc:string; category:string }

function classify(category:string, name:string) {
  const s = `${category} ${name}`.toLowerCase()
  if (/overnight|liquid|money market|ultra short|low duration|short duration|medium duration|long duration|credit risk|banking & psu|gilt|floater|corporate bond|dynamic bond|fixed maturity/.test(s)) return 'Debt'
  if (/arbitrage|balanced advantage|equity savings|aggressive hybrid|conservative hybrid|multi asset|dynamic asset allocation|hybrid/.test(s)) return 'Hybrid'
  if (/small cap/.test(s)) return 'Small Cap'
  if (/mid cap/.test(s)) return 'Mid Cap'
  if (/large & mid|large and mid/.test(s)) return 'Large & Mid Cap'
  if (/flexi cap/.test(s)) return 'Flexi Cap'
  if (/multi cap/.test(s)) return 'Multi Cap'
  if (/elss|tax saver/.test(s)) return 'ELSS'
  if (/index|nifty|sensex|etf|bse|fof|fund of fund/.test(s)) return 'Index / Passive'
  if (/sector|thematic|manufactur|infrastructure|pharma|banking|technology|consumption/.test(s)) return 'Thematic / Sectoral'
  if (/large cap/.test(s)) return 'Large Cap'
  if (/equity|growth|value|focused|contra|dividend yield/.test(s)) return 'Equity – Other'
  return category || 'Other'
}

export function parseAmfi(text:string): RawFund[] {
  const out: RawFund[] = []
  let category = 'Mutual Fund', amc = ''
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue
    const p = line.split(';').map(x=>x.trim())
    // AMFI NAVAll.txt format: Scheme Code;ISIN Payout/Growth;ISIN Reinvestment;Scheme Name;Plan;Option;NAV;Date
    if (p.length >= 8 && /^\d+$/.test(p[0])) {
      const nav = Number(p[6]); if (!Number.isFinite(nav) || nav <= 0) continue
      out.push({schemeCode:p[0], isin:p[1]||'', isinReinvestment:p[2]||'', schemeName:p[3], nav, navDate:p[7], amc, category:classify(category,p[3])})
    } else if (p.length === 1) {
      if (/Mutual Fund$/i.test(p[0])) amc = p[0]
      else if (/Scheme|Fund|ETF|Index|Debt|Equity|Hybrid|Solution|Thematic|Gold|Liquid|Overnight|Money Market|Arbitrage|FoF|ELSS/i.test(p[0])) category = p[0]
    }
  }
  return out
}

export async function fetchAmfiFunds() {
  const r = await fetch(AMFI_NAV_URL, { headers:{'User-Agent':'RVS-WealthPilot/14.0'}, cache:'no-store' })
  if (!r.ok) throw new Error(`AMFI HTTP ${r.status}`)
  return parseAmfi(await r.text())
}

export async function ingestAmfi() {
  const { query } = await import('@/lib/db')
  const funds = await fetchAmfiFunds()
  const run = await query<{id:string}>(`INSERT INTO ingestion_runs(source,status,started_at,records_seen) VALUES ('AMFI_NAV','running',now(),$1) RETURNING id`, [funds.length])
  const runId = run.rows[0].id
  let upserted = 0
  try {
    for (const f of funds) {
      await query(`INSERT INTO fund_schemes (scheme_code,isin,isin_reinvestment,scheme_name,amc,category,first_seen_at,last_seen_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,now(),now(),now())
        ON CONFLICT (scheme_code,isin) DO UPDATE SET scheme_name=EXCLUDED.scheme_name, amc=EXCLUDED.amc, category=EXCLUDED.category, isin_reinvestment=EXCLUDED.isin_reinvestment, last_seen_at=now(), updated_at=now()`,
        [f.schemeCode,f.isin,f.isinReinvestment,f.schemeName,f.amc,f.category])
      await query(`INSERT INTO nav_observations (scheme_code,isin,nav,nav_date,source,ingestion_run_id)
        VALUES ($1,$2,$3,$4::date,'AMFI_NAV',$5)
        ON CONFLICT (scheme_code,isin,nav_date) DO UPDATE SET nav=EXCLUDED.nav, ingestion_run_id=EXCLUDED.ingestion_run_id`,
        [f.schemeCode,f.isin,f.nav,normalizeDate(f.navDate),runId])
      upserted++
    }
    await query(`UPDATE ingestion_runs SET status='success',finished_at=now(),records_upserted=$2 WHERE id=$1`,[runId,upserted])
    return {runId,seen:funds.length,upserted,asOf:funds[0]?.navDate||null}
  } catch (e) {
    await query(`UPDATE ingestion_runs SET status='failed',finished_at=now(),error_message=$2,records_upserted=$3 WHERE id=$1`,[runId,e instanceof Error?e.message:'Unknown error',upserted])
    throw e
  }
}

function normalizeDate(s:string) {
  const m=s.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})$/)
  if (!m) throw new Error(`Unsupported AMFI date: ${s}`)
  const months:any={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12}
  return `${m[3]}-${String(months[m[2]]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`
}
