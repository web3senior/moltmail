/**
 * @file api/auth/verify/route.js
 * @description Verifies EIP-191 signatures, recovers the uncompressed public key,
 * and issues a session API token for agents.
 */

import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { recoverMessageAddress, recoverPublicKey, hashMessage } from 'viem'
import crypto from 'crypto'

export async function POST(req) {
  try {
    const { address, signature, nonce } = await req.json()

    // The standard EIP-191 challenge message
    const message = `MoltsChat Login Challenge: ${nonce}`

    /**
     * ■■■ Nonce Validation ■■■
     * Verify the nonce exists, hasn't expired, and immediately consume it
     * to prevent replay attacks.
     */
    const [nonceRows] = await pool.execute('SELECT id FROM auth_nonces WHERE nonce = ? AND expires_at > NOW()', [nonce])

    if (nonceRows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 403 })
    }

    // Consume nonce
    await pool.execute('DELETE FROM auth_nonces WHERE nonce = ?', [nonce])

    /**
     * ■■■ Signature Verification ■■■
     * 1. Recover Address: Proves ownership of the wallet.
     * 2. Recover Public Key: Extracts the 65-byte uncompressed key for encryption tasks.
     */
    const recoveredAddress = await recoverMessageAddress({
      message: message,
      signature: signature,
    })

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: 'Signature/Address mismatch' }, { status: 401 })
    }

    const publicKey = await recoverPublicKey({
      hash: hashMessage(message),
      signature: signature,
    })

    /**
     * ■■■ Database Synchronization ■■■
     * Upsert the wallet entry. If the agent changes their public key (rare),
     * we update it; otherwise, we ensure the link exists.
     */
    await pool.execute(
      `INSERT INTO wallets (address, public_key, created_at) 
       VALUES (?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE public_key = VALUES(public_key)`,
      [address.toLowerCase(), publicKey],
    )

    // Retrieve the wallet ID for foreign key assignment
    const [[wallet]] = await pool.execute('SELECT id FROM wallets WHERE address = ?', [address.toLowerCase()])

    /**
     * ■■■ API Token Generation ■■■
     * Generate a high-entropy 32-byte hex string.
     * We use ON DUPLICATE KEY to ensure one active key per wallet per session.
     */
    const apiKey = crypto.randomBytes(32).toString('hex')

    await pool.execute(
      `INSERT INTO agent_keys (wallet_id, api_key, status, created_at) 
       VALUES (?, ?, 'active', NOW()) 
       ON DUPLICATE KEY UPDATE 
          api_key = VALUES(api_key), 
          status = 'active',
          created_at = NOW()`,
      [wallet.id, apiKey],
    )

    // Return the token to the agent for future Bearer Auth headers
    return NextResponse.json({
      result: true,
      token: apiKey,
      publicKey: publicKey,
      address: address.toLowerCase(),
    })
  } catch (error) {
    console.error('Recovery Error:', error.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
