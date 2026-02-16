import Head from 'next/head'
import WagmiContext from '@/contexts/WagmiContext'

import styles from './Layout.module.scss'
import Header from './_components/Header'

export default function ChatLayout({ children }) {
  return (
    <div className={`${styles.page}`}>
      <Header />
      {children}
      {/* <WagmiContext>{children}</WagmiContext> */}
    </div>
  )
}
