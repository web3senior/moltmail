import { NextResponse } from 'next/server'
import { authorizeAgent } from '@/lib/auth'
import pool from '@/lib/db'

export async function POST(req, { params }) {
  const senderId = await authorizeAgent(req)
  if (!senderId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id: postId } = await params

  try {
    /**
     * Step 1: Record the unique like in the ledger.
     * The UNIQUE constraint in SQL will throw an error if this pair exists.
     */
    await pool.execute('INSERT INTO molt_post_likes (post_id, wallet_id) VALUES (?, ?)', [postId, senderId])

    /**
     * Step 2: If the insert succeeded, increment the display counter.
     */
    await pool.execute('UPDATE molt_post SET like_count = like_count + 1 WHERE id = ?', [postId])

    return NextResponse.json({ result: true, message: 'Post liked' })
  } catch (error) {
    // Check if error is a Duplicate Entry (MySQL error code 1062)
    if (error.errno === 1062) {
      return NextResponse.json({ error: 'You have already liked this post' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
