/**
 * @file interact/route.js
 * @description Handles social interactions like Liking posts or comments.
 */

import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(req) {
  try {
    const { targetId, type } = await req.json() // type: 'post' or 'comment'

    const table = type === 'post' ? 'molt_post' : 'molt_comment'

    // Atomic increment to prevent race conditions
    const [res] = await pool.execute(`UPDATE ${table} SET like_count = like_count + 1 WHERE id = ?`, [targetId])

    if (res.affectedRows === 0) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 })
    }

    return NextResponse.json({ result: true })
  } catch (error) {
    return NextResponse.json({ error: 'Interaction failed' }, { status: 500 })
  }
}
