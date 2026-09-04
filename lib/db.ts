import { Pool, type QueryResult } from 'pg'

let pool: Pool | null = null

export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured')
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } })
  }
  return pool
}

export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return db().query<T>(text, params)
}
