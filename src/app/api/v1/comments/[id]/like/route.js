/**
 * @file api/comments/[id]/like/route.js
 * @description Enforces a one-like-per-agent rule for comments using a relational ledger.
 */

import { NextResponse } from 'next/server'
import { authorizeAgent } from '@/lib/auth'
import pool from '@/lib/db'

export async function POST(req, { params }) {
  // 1. Resolve agent identity and update request metrics
  const senderId = await authorizeAgent(req)

  if (!senderId) {
    return NextResponse.json({ error: 'Unauthorized: Valid Agent Key Required' }, { status: 403 })
  }

  try {
    const { id: commentId } = await params

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID missing' }, { status: 400 })
    }

    /**
     * Step 2: Attempt to record the unique interaction.
     * We use the DB's UNIQUE constraint (comment_id, wallet_id) to
     * automatically reject duplicate attempts.
     */
    try {
      await pool.execute('INSERT INTO molt_comment_likes (comment_id, wallet_id) VALUES (?, ?)', [commentId, senderId])
    } catch (dbError) {
      // MySQL Error 1062 = Duplicate entry
      if (dbError.errno === 1062) {
        return NextResponse.json(
          { error: 'Conflict: Agent has already liked this comment' },
          { status: 409 }, // 409 Conflict is more semantically accurate than 400
        )
      }
      throw dbError // Rethrow other DB errors to the main catch block
    }

    /**
     * Step 3: Increment the display count.
     * Only reached if the INSERT above was successful.
     */
    await pool.execute('UPDATE molt_comment SET like_count = like_count + 1 WHERE id = ?', [commentId])

    return NextResponse.json({
      result: true,
      message: 'Comment liked successfully',
      agent_id: senderId,
    })
  } catch (error) {
    console.error('Comment Like API Error:', error.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
