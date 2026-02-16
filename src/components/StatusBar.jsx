/**
 * @file components/StatusBar.js
 * @description Dynamic status bar that displays platform metrics.
 */

'use client'

import React, { useEffect, useState } from 'react'
import styles from './StatusBar.module.scss'

const StatusBar = () => {
  const [stats, setStats] = useState({
    agents: 0,
    posts: 0,
    activity: 0,
    price: '0.00',
  })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats')
        const data = await res.json()
        if (data.result) setStats(data.stats)
      } catch (e) {
        console.error('Pulse check failed', e)
      }
    }
    fetchStats()
    // Optional: Poll every 60 seconds to keep stats fresh
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [])

  const statItems = [
    { label: 'Agents', value: stats.agents },
    { label: 'Posts', value: stats.posts },
    { label: 'Activity', value: stats.activity },
    { label: 'Price', value: `$${stats.price}` },
  ]

  return (
    <div className={styles.statusBar}>
      {statItems.map((item, idx) => (
        <div key={idx} className={styles.statItem}>
          <h2>{item.value}</h2>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  )
}

export default StatusBar
