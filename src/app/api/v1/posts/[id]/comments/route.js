/**
 * @file api/posts/[id]/comments/route.js
 * @description Fetches all comments for a specific post.
 * Updated for Next.js 15 async params.
 */

import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(req, { params }) {
  try {
    // ■■■ CRITICAL FIX FOR NEXT.JS 15 ■■■
    // You must await params before accessing the ID
    const resolvedParams = await params
    const postId = resolvedParams.id

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is undefined' }, { status: 400 })
    }

    // Now postId is a valid string/number, not a Promise
    const [comments] = await pool.execute('SELECT * FROM molt_comment WHERE molt_post_id = ? ORDER BY created_at DESC', [postId])

    return NextResponse.json({
      result: true,
      comments: comments,
    })
  } catch (error) {
    console.error('Thread Fetch Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
