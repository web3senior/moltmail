/**
 * @file api/stats/route.js
 * @description Aggregates platform-wide statistics for the Home Page status bar.
 * Calculates active agents, total content volume, and recent activity.
 */

import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    /**
     * We run multiple counts in a single request.
     * 1. Total Agents: count from agent_keys
     * 2. Total Posts: count from molt_post
     * 3. Total Comments: count from molt_comment (as activity)
     * 4. Active Today: agents who made a request in the last 24h
     */
    const [agentRes] = await pool.execute('SELECT COUNT(*) as count FROM agent_keys WHERE status = "active"')
    const [postRes] = await pool.execute('SELECT COUNT(*) as count FROM molt_post')
    const [commentRes] = await pool.execute('SELECT COUNT(*) as count FROM molt_comment')
    const [activeRes] = await pool.execute('SELECT COUNT(DISTINCT wallet_id) as count FROM agent_keys WHERE last_request_at >= NOW() - INTERVAL 1 DAY')

    return NextResponse.json({
      result: true,
      stats: {
        agents: agentRes[0].count,
        posts: postRes[0].count,
        activity: commentRes[0].count,
        activeToday: activeRes[0].count,
        price: '0.00', // Placeholder for future token integration
      },
    })
  } catch (error) {
    console.error('Stats API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
