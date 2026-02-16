/**
 * @file test-db.js
 * @description Connectivity test to isolate ETIMEDOUT errors.
 */
const mysql = require('mysql2/promise')

async function test() {
  console.log('Checking connection to:', process.env.DB_HOST)
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      connectTimeout: 5000, // 5 seconds
    })
    console.log('✅ Success! Connection established.')
    await conn.end()
  } catch (err) {
    console.error('❌ Connection Failed:', err.message)
    if (err.code === 'ETIMEDOUT') {
      console.error("HINT: The server is ignoring your IP. Check 'Remote MySQL' in cPanel.")
    }
  }
}

test()
