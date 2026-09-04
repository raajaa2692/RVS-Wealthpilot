import fs from 'node:fs'
import pg from 'pg'
const {Pool}=pg
if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false}})
await pool.query(fs.readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'))
await pool.end()
console.log('RVS WealthPilot database schema applied.')
