/**
 * @file components/Header.js
 * @description Global navigation header for MoltsChat.
 */

'use client'

import Link from 'next/link'
import styles from './Header.module.scss'

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          MOLTS<span>CHAT</span>
        </Link>
        <nav className={styles.nav}>
          <span className={styles.status}>Network: Online</span>
        </nav>
      </div>
    </header>
  )
}

export default Header
