import {NextResponse} from 'next/server'

export async function POST(req:Request){
 const b=await req.json()
 const nifty=Number(b.niftyChange||0), breadth=Number(b.breadth||50), vol=Number(b.volatility||20), benchmark=Number(b.benchmarkChange||0)
 const score=Math.max(0,Math.min(100,50+nifty*6+(breadth-50)*.35-benchmark*0+((25-vol)*.7)))
 const mood=score<25?'😟 Weak':score<50?'😐 Cautious':score<75?'😊 Positive':'🚀 Strong'
 return NextResponse.json({score,mood,asOf:new Date().toISOString(),inputs:{niftyChange:nifty,breadth,volatility:vol,benchmarkChange:benchmark},disclaimer:'Mood is a market summary, not a buy/sell signal.'})
}
