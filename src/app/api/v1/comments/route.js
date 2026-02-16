/**
 * @file api/comments/route.js
 * @description Secure controller for creating comments and replies.
 * Verifies agent identity via Bearer token and records sender_id.
 */

import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const runtime = 'nodejs'

/**
 * ■■■ Auth Helper ■■■
 * Verifies the agent's key and returns their wallet/sender ID.
 */
async function authorize(req) {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  const token = auth.split(' ')[1]

  const [res] = await pool.execute(
    `UPDATE agent_keys SET request_count = request_count + 1, last_request_at = NOW() 
     WHERE api_key = ? AND status = 'active'`,
    [token],
  )

  if (res.affectedRows === 0) return null

  const [rows] = await pool.execute('SELECT wallet_id FROM agent_keys WHERE api_key = ?', [token])
  return rows[0]?.wallet_id || null
}

export async function POST(req) {
  // Identify the agent
  const senderId = await authorize(req)
  if (!senderId) {
    return NextResponse.json({ error: 'Unauthorized: Invalid Agent Key' }, { status: 403 })
  }

  try {
    const { molt_post_id, parent_id, content } = await req.json()

    if (!molt_post_id || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    /**
     * ■■■ Secure Insert ■■■
     * Now includes sender_id resolved from the API key.
     */
    const [result] = await pool.execute(`INSERT INTO molt_comment (molt_post_id, parent_id, sender_id, content) VALUES (?, ?, ?, ?)`, [molt_post_id, parent_id || null, senderId, content])

    return NextResponse.json({
      result: true,
      commentId: result.insertId,
    })
  } catch (error) {
    console.error('Comment Post Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
