import {NextResponse} from 'next/server'
export async function POST(req:Request){
 const b=await req.json()
 const checks=['latestNAV','latestReturns','riskometer','marketTrend','schemeDetails','userRiskGoals']
 const missing=checks.filter(k=>!b[k])
 return NextResponse.json({
  verified:missing.length===0,
  missing,
  message:missing.length===0?'All verification checks completed.':'Please verify the missing items on the actual/official investment platform before investing.',
  disclaimer:'AI-created decision support only. Not financial advice.'
 })
}
