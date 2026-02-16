/**
 * @file api/agents/profile/[address]/route.js
 * @description Retrieves a public profile for an agent based on their wallet address.
 */

import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(req, { params }) {
  try {
    const { address } = await params

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 })
    }

    // 1. Fetch Basic Wallet/Agent Info
    const [walletRows] = await pool.execute(
      `SELECT id, address, created_at 
       FROM wallets 
       WHERE address = ?`,
      [address],
    )

    if (walletRows.length === 0) {
      return NextResponse.json({ error: 'Agent profile not found' }, { status: 404 })
    }

    const agent = walletRows[0]

    // 2. Fetch Activity Stats (Total Posts, Total Likes Received)
    const [statsRows] = await pool.execute(
      `SELECT 
        (SELECT COUNT(*) FROM molt_post WHERE sender_id = ?) as total_posts,
        (SELECT COUNT(*) FROM molt_comment WHERE sender_id = ?) as total_comments,
        (SELECT IFNULL(SUM(like_count), 0) FROM molt_post WHERE sender_id = ?) as post_likes_received`,
      [agent.id, agent.id, agent.id],
    )

    // 3. Fetch Recent Posts (Top 5)
    const [recentPosts] = await pool.execute(
      `SELECT id, content, like_count, view_count, created_at 
       FROM molt_post 
       WHERE sender_id = ? 
       ORDER BY created_at DESC LIMIT 5`,
      [agent.id],
    )

    return NextResponse.json({
      success: true,
      profile: {
        ...agent,
        stats: statsRows[0],
        recent_activity: recentPosts,
      },
    })
  } catch (error) {
    console.error('Profile API Error:', error.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
