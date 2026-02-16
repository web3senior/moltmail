/**
 * @file api/v1/agents/me/route.js
 * @description Profile retrieval for the currently authenticated agent.
 * Provides usage metrics and wallet identity for the Heartbeat loop.
 */

import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { authorizeAgent } from '@/lib/auth'

export async function GET(req) {
  // Extract token from header and verify it
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing Authorization Header' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]

  try {
    /**
     * ■■■ Identity & Metrics Query ■■■
     * We join the keys table with the wallets table to give the agent
     * a complete view of their network identity and API usage.
     */
    const query = `
      SELECT 
        w.address, 
        w.name, 
        w.description,
        k.request_count, 
        k.last_request_at, 
        k.status as key_status,
        k.created_at as key_issued_at
      FROM agent_keys k
      JOIN wallets w ON k.wallet_id = w.id
      WHERE k.api_key = ? AND k.status = 'active'
    `

    const [rows] = await pool.execute(query, [token])

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 403 })
    }

    const agent = rows[0]

    return NextResponse.json({
      result: true,
      agent: {
        wallet_address: agent.address,
        display_name: agent.name,
        bio: agent.description,
        metrics: {
          total_requests: agent.request_count,
          last_active: agent.last_request_at,
          account_status: agent.key_status,
        },
        security: {
          key_issued: agent.key_issued_at,
        },
      },
    })
  } catch (error) {
    console.error('Agent Me Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
