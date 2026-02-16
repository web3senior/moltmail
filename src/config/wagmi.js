import { http, createConfig } from 'wagmi'
import { luksoTestnet, lukso, monad } from 'wagmi/chains'
import { injected, metaMask, safe, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ``

export const CONTRACTS = {
  chain4201: {
    // LUKSO testnet
    forwarder: '0x3d3AE14163C0fe23317b322908e6CC0D4289e0A7',
    chat: '0xCA6a25e14873871b116011803F5E2FD2B9442E59',
  },
  chain42: {
    // LUKSO
    forwarder: '0xaa609a768A0A9c67A1d9B6F33Cb965C69bC0026E',
    chat: '0x5D339E1D5Bb6Eb960600c907Ae6E7276D8196240',
  },
  chain143: {
    // Monad
    forwarder: '0xc407722d150c8a65e890096869f8015D90a89EfD',
    chat: '0xA5e73b15c1C3eE477AED682741f0324C6787bbb8',
  },
}

// Customize LUKSO Testnet chain object
luksoTestnet.icon = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_10950_4143)"><mask id="mask0_10950_4143" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="18" height="18"><path d="M18 0H0V18H18V0Z" fill="white"/></mask><g mask="url(#mask0_10950_4143)"><path d="M0 0H18V18H0V0Z" fill="#F0F3FA"/><path d="M10.0922 3.26602L13.908 5.2667C14.58 5.62682 15 6.27704 15 6.98729V10.9986C15 11.7089 14.58 12.3691 13.908 12.7293L10.0922 14.7299C9.4202 15.09 8.58023 15.09 7.90826 14.7299L4.09237 12.7293C3.75034 12.5407 3.47094 12.2832 3.28006 11.9807C3.08917 11.6782 2.99298 11.3404 3.0004 10.9986V6.99729C3.0004 6.27704 3.42039 5.62682 4.09237 5.2667L7.90826 3.26602C8.23434 3.0923 8.61323 3 9.00022 3C9.3872 3 9.7661 3.0923 10.0922 3.26602ZM10.4521 10.6885L11.3161 9.30808C11.4361 9.10802 11.4361 8.87794 11.3161 8.68787L10.4401 7.3074C10.3875 7.21668 10.3059 7.13978 10.2042 7.0851C10.1027 7.0304 9.98506 7.00003 9.86419 6.99729H8.13624C7.89626 6.99729 7.66825 7.11733 7.56027 7.29739L6.68429 8.69787C6.56429 8.87794 6.56429 9.11801 6.68429 9.29807L7.56027 10.6985C7.68025 10.8786 7.89626 10.9986 8.13624 10.9986H9.86419C10.1042 10.9986 10.3321 10.8786 10.4401 10.6985L10.4521 10.6885Z" fill="#FE005B"/></g></g><defs><clipPath id="clip0_10950_4143"><rect width="18" height="18" fill="white"/></clipPath></defs></svg>`
luksoTestnet.faucetUrl = `https://faucet.testnet.lukso.network/`
luksoTestnet.primaryColor = `#FD1669`
luksoTestnet.textColor = `#fff`

lukso.icon = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_10950_4143)"><mask id="mask0_10950_4143" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="18" height="18"><path d="M18 0H0V18H18V0Z" fill="white"/></mask><g mask="url(#mask0_10950_4143)"><path d="M0 0H18V18H0V0Z" fill="#F0F3FA"/><path d="M10.0922 3.26602L13.908 5.2667C14.58 5.62682 15 6.27704 15 6.98729V10.9986C15 11.7089 14.58 12.3691 13.908 12.7293L10.0922 14.7299C9.4202 15.09 8.58023 15.09 7.90826 14.7299L4.09237 12.7293C3.75034 12.5407 3.47094 12.2832 3.28006 11.9807C3.08917 11.6782 2.99298 11.3404 3.0004 10.9986V6.99729C3.0004 6.27704 3.42039 5.62682 4.09237 5.2667L7.90826 3.26602C8.23434 3.0923 8.61323 3 9.00022 3C9.3872 3 9.7661 3.0923 10.0922 3.26602ZM10.4521 10.6885L11.3161 9.30808C11.4361 9.10802 11.4361 8.87794 11.3161 8.68787L10.4401 7.3074C10.3875 7.21668 10.3059 7.13978 10.2042 7.0851C10.1027 7.0304 9.98506 7.00003 9.86419 6.99729H8.13624C7.89626 6.99729 7.66825 7.11733 7.56027 7.29739L6.68429 8.69787C6.56429 8.87794 6.56429 9.11801 6.68429 9.29807L7.56027 10.6985C7.68025 10.8786 7.89626 10.9986 8.13624 10.9986H9.86419C10.1042 10.9986 10.3321 10.8786 10.4401 10.6985L10.4521 10.6885Z" fill="#FE005B"/></g></g><defs><clipPath id="clip0_10950_4143"><rect width="18" height="18" fill="white"/></clipPath></defs></svg>`
lukso.faucetUrl = `https://faucet.testnet.lukso.network/`
lukso.primaryColor = `#FD1669`
lukso.textColor = `#fff`

// Customize Monad Testnet chain object
monad.icon = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="18" height="18" fill="white"/><path d="M8.99996 3C7.26731 3 3 7.2672 3 8.99996C3 10.7327 7.26731 15 8.99996 15C10.7326 15 15 10.7326 15 8.99996C15 7.26727 10.7327 3 8.99996 3ZM8.06498 12.431C7.33433 12.2319 5.36993 8.79563 5.56906 8.06498C5.76819 7.33429 9.20437 5.36992 9.93499 5.56905C10.6657 5.76815 12.6301 9.20434 12.431 9.93503C12.2318 10.6657 8.79563 12.6301 8.06498 12.431Z" fill="#836EF9"/></svg>`
monad.faucetUrl = `https://faucet.monad.xyz/`
// monad.rpcUrls.default.http = ['https://rpc.ankr.com/monad_testnet']
monad.primaryColor = `#836EF9`
monad.textColor = `#fff`

// CELO
// celoSepolia.icon = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"> <g clip-path="url(#clip0_10733_2648)"> <path d="M0 0H18V18H0V0Z" fill="#FCFE52"/> <path d="M5 5H13V8H11.83C11.5941 7.33279 11.1299 6.77045 10.5195 6.41237C9.90911 6.05429 9.19176 5.92353 8.49427 6.0432C7.79677 6.16288 7.16404 6.52527 6.70789 7.06634C6.25175 7.60741 6.00157 8.29231 6.00157 9C6.00157 9.70769 6.25175 10.3926 6.70789 10.9337C7.16404 11.4747 7.79677 11.8371 8.49427 11.9568C9.19176 12.0765 9.90911 11.9457 10.5195 11.5876C11.1299 11.2296 11.5941 10.6672 11.83 10H13V13H5V5Z" fill="black"/> </g> <defs> <clipPath id="clip0_10733_2648"> <rect width="18" height="18" fill="white"/> </clipPath> </defs> </svg>`
// celoSepolia.faucetUrl = `https://faucet.celo.org/celo-sepolia/`
// celoSepolia.primaryColor = `#fcff52`
// celoSepolia.textColor = `#333`

export const config = createConfig({
  chains: [lukso, monad], //, luksoTestnet,
  connectors: [injected(), walletConnect({ projectId }), metaMask(), safe()],
  transports: {
    // [luksoTestnet.id]: http(),
    [lukso.id]: http(),
    [monad.id]: http(),
  },
  ssr: true,
})

/**
 * Set network colors
 * @param {json} chain
 */
export const setNetworkColor = (chain) => {
  const rootElement = document.documentElement
  rootElement.style.setProperty(`--network-color-primary`, chain.primaryColor)
  rootElement.style.setProperty(`--network-color-text`, chain.textColor)
}

/**
 * Get network colors
 * @param {json} chain
 */
export const getNetworkColor = () => {
  const rootElement = document.documentElement
  const primaryColor = rootElement.style.getPropertyValue(`--network-color-primary`)
  const secondaryColor = rootElement.style.getPropertyValue(`--network-color-text`)
  return { primaryColor, secondaryColor }
}

console.log(config)
