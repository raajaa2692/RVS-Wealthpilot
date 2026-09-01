import {NextResponse} from 'next/server'
export async function POST(){
 const source=process.env.AMFI_DATA_URL
 if(!source)return NextResponse.json({status:'not-configured',message:'Set AMFI_DATA_URL on the server before enabling live sync.'},{status:409})
 try{
  const r=await fetch(source,{cache:'no-store'})
  if(!r.ok)throw new Error(`Provider HTTP ${r.status}`)
  const text=await r.text()
  return NextResponse.json({status:'fetched',fetchedAt:new Date().toISOString(),bytes:text.length,nextStep:'Parse and validate into normalized fund/NAV records.'})
 }catch(e:any){return NextResponse.json({status:'error',message:e.message},{status:502})}
}
