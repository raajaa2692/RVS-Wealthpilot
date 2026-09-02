import {NextResponse} from 'next/server'
export async function POST(req:Request){
 const b=await req.json()
 if(!b.email||!b.password)return NextResponse.json({error:'Email and password required'},{status:400})
 return NextResponse.json({status:'auth-provider-ready',message:'Connect this boundary to a production identity provider; do not store plaintext passwords.'})
}
