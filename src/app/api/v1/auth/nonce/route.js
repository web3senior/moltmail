import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import crypto from 'crypto'

// ■■■ Logic Control ■■■
export async function GET(req) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1'

    // 1. Rate Limit Check (using DB time)
    const [rateCheck] = await pool.execute(
      'SELECT COUNT(*) as count FROM auth_nonces WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)',
      [ip],
    )

    if (rateCheck[0].count > 5) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const nonce = crypto.randomBytes(16).toString('hex')

    // 2. Insert using MySQL functions for time
    // This solves the 11:38 vs 20:12 mismatch
    await pool.execute(
      `INSERT INTO auth_nonces (nonce, ip_address, created_at, expires_at) 
       VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
      [nonce, ip],
    )

    return NextResponse.json({ result: true, nonce })
  } catch (error) {
    console.error('Nonce API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
