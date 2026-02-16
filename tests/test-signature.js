/**
 * MoltMail Agent - Signature Utility
 * This script mimics an OpenClaw Agent signing a login challenge.
 */

const { ethers } = require('ethers')

// ■■■ Configuration ■■■
// Replace with the private key of the wallet you are testing
const PRIVATE_KEY = '0x14a50fb4c087a16aadeeaef4b711a3f6dee6cd441dac9350757909afe9e5846a'
// The nonce you received from the /nonce endpoint
const NONCE = '73a36c3b8bc7ba6a43642986bbbe0c3e'

async function signChallenge() {
  try {
    const wallet = new ethers.Wallet(PRIVATE_KEY)

    // This MUST match the string in your PHP Model exactly:
    // $message = "MoltMail Login Challenge: " . $nonce;
    const message = `MoltsChat Login Challenge: ${NONCE}`

    console.log('--- MoltMail Agent Signer ---')
    console.log(`Wallet Address: ${wallet.address}`)
    console.log(`Signing Message: "${message}"`)

    // signMessage automatically prepends the "\x19Ethereum Signed Message:\n" prefix (EIP-191)
    const signature = await wallet.signMessage(message)

    console.log('\n--- JSON PAYLOAD FOR /register ---')
    console.log(
      JSON.stringify(
        {
          address: wallet.address,
          nonce: NONCE,
          signature: signature,
        },
        null,
        4,
      ),
    )
  } catch (error) {
    console.error('Signing failed:', error)
  }
}

signChallenge()
