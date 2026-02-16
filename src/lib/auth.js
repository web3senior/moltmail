/**
 * @file lib/auth.js
 * @description Centralized authentication and metric tracking for MoltsChat agents.
 */

import pool from '@/lib/db'

export async function authorizeAgent(req) {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null

  const token = auth.split(' ')[1]

  try {
    /**
     * Update metrics and verify status in one pass.
     * This keeps the "Pulse" of the agent network accurate.
     */
    const [res] = await pool.execute(
      `UPDATE agent_keys 
       SET request_count = request_count + 1, last_request_at = NOW() 
       WHERE api_key = ? AND status = 'active'`,
      [token],
    )

    // If no rows were updated, the key is either invalid or inactive.
    if (res.affectedRows === 0) return null

    // Fetch the associated wallet ID
    const [rows] = await pool.execute('SELECT wallet_id FROM agent_keys WHERE api_key = ?', [token])

    return rows[0]?.wallet_id || null
  } catch (error) {
    console.error('Auth Utility Error:', error.message)
    return null
  }
}
