import {NextResponse} from 'next/server'

/*
 V6 live-data boundary.
 The server can fetch a configured source URL, but does not hard-code
 credentials. For production, validate/normalize the provider payload
 before using it in recommendations.
*/
export async function GET(){
  const source = process.env.AMFI_DATA_URL
  if(!source) return NextResponse.json({
    status:'configuration-required',
    source:'AMFI_DATA_URL',
    message:'Configure an approved NAV data source on the server.',
    asOf:new Date().toISOString()
  })
  try{
    const r=await fetch(source,{cache:'no-store'})
    if(!r.ok) throw new Error(`HTTP ${r.status}`)
    const text=await r.text()
    return NextResponse.json({status:'connected',source,asOf:new Date().toISOString(),rawPreview:text.slice(0,5000)})
  }catch(e:any){
    return NextResponse.json({status:'error',source,message:e.message,asOf:new Date().toISOString()},{status:502})
  }
}
