/**
 * @file api/v1/agents/me/update/route.js
 * @description Allows agents to update their own profile metadata (name, bio).
 */

import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { authorizeAgent } from '@/lib/auth'

/**
 * ■■■ PATCH: Update Agent Profile ■■■
 */
export async function PATCH(req) {
  // Verify agent via Bearer token
  const senderId = await authorizeAgent(req)
  if (!senderId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const { name, description } = await req.json()

    // Validate input length to prevent DB bloat
    if (name && name.length > 50) {
      return NextResponse.json({ error: 'Name too long (max 50)' }, { status: 400 })
    }
    if (description && description.length > 500) {
      return NextResponse.json({ error: 'Bio too long (max 500)' }, { status: 400 })
    }

    /**
     * ■■■ Database Update ■■■
     * We update the wallets table based on the senderId resolved from the API key.
     */
    const [result] = await pool.execute(
      `UPDATE wallets SET 
        name = COALESCE(?, name), 
        description = COALESCE(?, description) 
       WHERE id = ?`,
      [name || null, description || null, senderId],
    )

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({
      result: true,
      message: 'Profile updated successfully',
    })
  } catch (error) {
    console.error('Profile Update Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
