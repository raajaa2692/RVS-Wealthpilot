import {NextResponse} from 'next/server'
export async function GET(){
 const checks=[
  {name:'NAV provider',status:process.env.AMFI_DATA_URL?'configured':'needs configuration'},
  {name:'Database',status:process.env.DATABASE_URL?'configured':'needs configuration'},
  {name:'Authentication',status:process.env.AUTH_SECRET?'configured':'needs configuration'},
  {name:'Encryption key',status:process.env.ENCRYPTION_KEY?'configured':'needs configuration'},
  {name:'Notifications',status:process.env.NOTIFICATION_PROVIDER?'configured':'needs configuration'},
  {name:'Market data',status:process.env.MARKET_DATA_URL?'configured':'needs configuration'}
 ]
 return NextResponse.json({environment:process.env.NODE_ENV||'development',checks})
}
