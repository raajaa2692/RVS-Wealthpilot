import { unstable_cache } from 'next/cache'

export const AMFI_HISTORY = 'https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx'
export const DISCLOSURE_SOURCES = {
  factsheets:'https://www.amfiindia.com/online-center/download-factsheets',
  riskometer:'https://www.amfiindia.com/online-center/risk-o-meter',
  ter:'https://www.amfiindia.com/ter-of-mf-schemes'
}

export const cachedFetchText = unstable_cache(
  async (url:string) => {
    const r = await fetch(url, {headers:{'User-Agent':'RVS-WealthPilot/13'}, cache:'no-store'})
    if (!r.ok) throw new Error(`AMFI HTTP ${r.status}`)
    return await r.text()
  },
  ['rvs-amfi-text-v1'],
  { revalidate: 86400 }
)

export const cachedDisclosurePages = unstable_cache(
  async () => {
    const [factsheets, riskometer, ter] = await Promise.all([
      cachedFetchText(DISCLOSURE_SOURCES.factsheets),
      cachedFetchText(DISCLOSURE_SOURCES.riskometer),
      cachedFetchText(DISCLOSURE_SOURCES.ter),
    ])
    return {factsheets, riskometer, ter}
  },
  ['rvs-amfi-disclosure-pages-v1'],
  { revalidate: 86400 }
)

export const cachedHistoryWindow = unstable_cache(
  async (url:string) => cachedFetchText(url),
  ['rvs-amfi-history-window-v1'],
  { revalidate: 86400 }
)
