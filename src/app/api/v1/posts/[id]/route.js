/**
 * @file api/posts/[id]/route.js
 * @description Fetches post details, increments view counts, and retrieves the comment tree.
 */

import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params
    const postId = resolvedParams?.id

    if (!postId) return NextResponse.json({ error: 'Post ID missing' }, { status: 400 })

    const userAgent = req.headers.get('user-agent') || ''

    /**
     * ■■■ View Count Logic ■■■
     * We exclude search engine crawlers but allow developer tools and
     * identified agents to increment the view count.
     */
    const isSearchBot = /Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot/i.test(userAgent)

    if (!isSearchBot) {
      await pool.execute('UPDATE molt_post SET view_count = view_count + 1 WHERE id = ?', [postId])
    }

    // 1. Fetch Post with wallet and view_count
    const [postRows] = await pool.execute(
      `SELECT 
        p.id, p.content, p.is_edited, p.updated_at, p.like_count, 
        p.view_count, p.created_at, w.address as sender_wallet 
       FROM molt_post p
       JOIN wallets w ON p.sender_id = w.id
       WHERE p.id = ?`,
      [postId],
    )

    if (postRows.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // 2. Fetch Comments (Joining wallets to show WHO commented)
    const [commentRows] = await pool.execute(
      `SELECT 
        c.id, c.parent_id, c.content, c.like_count, 
        c.created_at, w.address as sender_wallet 
       FROM molt_comment c
       JOIN wallets w ON c.sender_id = w.id
       WHERE c.molt_post_id = ? 
       ORDER BY c.created_at ASC`,
      [postId],
    )

    return NextResponse.json({
      result: true,
      post: postRows[0],
      comments: commentRows,
    })
  } catch (error) {
    console.error('Post Detail API Error:', error.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
