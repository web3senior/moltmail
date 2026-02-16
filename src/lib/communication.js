import Web3 from 'web3'
import { config, CONTRACTS, setNetworkColor } from '@/config/wagmi'
import chatAbi from '@/lib/abi/chat.json'

export const getActiveChain = (connectedChainId) => {
  // 1. Prioritize the chain ID passed from Wagmi's useAccount/useChainId
  // 2. Fall back to localStorage
  // 3. Fall back to hardcoded Default
  const DEFAULT_CHAIN_ID = 143 // Monad

  let targetId = DEFAULT_CHAIN_ID

  if (connectedChainId) {
    targetId = connectedChainId
  } else if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(`${process.env.NEXT_PUBLIC_LOCALSTORAGE_PREFIX}active-chain`)
    if (saved) targetId = parseInt(saved)
  }

  const userSelectedChain = config.chains.find((c) => c.id.toString() === targetId.toString())

  if (userSelectedChain) {
    // Only run side-effects on client
    if (typeof window !== 'undefined') {
      setNetworkColor(userSelectedChain)
    }
    return [userSelectedChain, CONTRACTS[`chain${userSelectedChain.id}`]]
  }

  // Fallback
  const defaultChain = config.chains.find((c) => c.id === DEFAULT_CHAIN_ID)
  return [defaultChain, CONTRACTS[`chain${DEFAULT_CHAIN_ID}`]]
}

// Initialize chat contract
export function initChatContract() {
  const activeChain = getActiveChain()
  const rpcUrl = activeChain[0].rpcUrls.default.http[0]

  if (!rpcUrl) throw new Error('WEB3_RPC_URL is not defined in environment variables.')

  // Initialize Web3 with an HttpProvider for server-side connection
  const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl))

  // Create a Contract instance
  const contract = new web3.eth.Contract(chatAbi, activeChain[1].chat)
  return { web3, contract }
}

// Get user session
export async function getUserSessions(address) {
  const { web3, contract } = initChatContract()

  try {
    const result = await contract.methods.userSessions(address).call()
    return result
  } catch (error) {
    console.error('Error fetching contract data with Web3.js:', error)
    return { error }
  }
}

export async function getPublicKeyRegistry(address) {
  const { web3, contract } = initChatContract()

  try {
    const result = await contract.methods.publicKeyRegistry(address).call()
    return result
  } catch (error) {
    console.error('Error fetching contract data with Web3.js:', error)
    return { error }
  }
}

// Get conversation list events
export async function getConversationListEvents(userAddress) {
  const { contract } = initChatContract()
  try {
    // Fetch both directions
    const [sentEvents, receivedEvents] = await Promise.all([
      contract.getPastEvents('MessageSent', {
        filter: { sender: userAddress },
        fromBlock: 0,
        toBlock: 'latest',
      }),
      contract.getPastEvents('MessageSent', {
        filter: { receiver: userAddress },
        fromBlock: 0,
        toBlock: 'latest',
      }),
    ])

    const contactMap = new Map()

    const processEvent = (event, isSender) => {
      const vals = event.returnValues
      // If I sent it, the contact is the receiver. If I received it, the contact is the sender.
      const contactAddr = isSender ? vals.receiver : vals.sender

      if (contactAddr.toLowerCase() === userAddress.toLowerCase()) return

      // Note: Since 'timestamp' isn't in your Solidity event, we use a placeholder or
      // you must add 'uint256 timestamp' to the event in your contract.
      const existing = contactMap.get(contactAddr)

      // We keep the most recent one (assuming events are ordered by blockNumber)
      contactMap.set(contactAddr, {
        contactAddress: contactAddr,
        lastMessage: {
          // If you update Solidity event to include timestamp, use vals.timestamp
          // Otherwise, we use blockNumber as a proxy or fetch the block.
          timestamp: vals.timestamp || 0,
        },
      })
    }

    sentEvents.forEach((e) => processEvent(e, true))
    receivedEvents.forEach((e) => processEvent(e, false))

    return Array.from(contactMap.values())
  } catch (error) {
    console.error('Error fetching private contact list:', error)
    return []
  }
}
