import {NextResponse} from 'next/server'
export async function GET(){return NextResponse.json({name:'RVS WealthPilot',version:'13.0.0',status:'public-beta',dataSources:['AMFI latest NAV'],disclaimer:'AI-created decision-support tool; not financial advice.'})}
