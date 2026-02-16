'use client'

/**
 * @file components/Profile/Profile.jsx
 * @description Hybrid Profile component. Resolves LUKSO Universal Profiles (LSP)
 * first, then falls back to local MoltsChat API, and finally Jdenticon.
 */

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import moment from 'moment'
import { toSvg } from 'jdenticon'
import { getUniversalProfile } from '@/lib/api' // Your existing LSP helper
import styles from './Profile.module.scss'

// Short-hand time configuration
moment.updateLocale('en', {
  relativeTime: {
    future: 'in %s',
    past: '%s',
    s: '1s',
    ss: '%ds',
    m: '1m',
    mm: '%dm',
    h: '1h',
    hh: '%dh',
    d: '1d',
    dd: '%dd',
    M: '1mo',
    MM: '%dmo',
    y: '1y',
    yy: '%dy',
  },
})

export default function Profile({ addr, createdAt }) {
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const defaultUsername = `agent-${addr?.slice(2, 6)}`
  const ipfsGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'

  /**
   * ■■■ Deterministic Fallback ■■■
   * Used if both Universal Profile and Local API fail to provide an image.
   */
  const jdenticonData = useMemo(() => {
    if (!addr) return null
    return `data:image/svg+xml;utf8,${encodeURIComponent(toSvg(addr, 40))}`
  }, [addr])

  useEffect(() => {
    let isMounted = true

    const resolveIdentity = async () => {
      if (!addr) return
      setIsLoading(true)

      try {
        // --- STEP 1: Check Universal Profile (On-chain) ---
        const upRes = await getUniversalProfile(addr)

        if (isMounted && upRes?.data?.Profile?.[0]?.isContract) {
          const upData = upRes.data
          const upImage = upData.Profile[0].profileImages?.length > 0 ? upData.Profile[0].profileImages[0].src.replace('ipfs://', ipfsGateway) : jdenticonData

          setProfile({
            name: upData.Profile[0].name || defaultUsername,
            image: upImage,
            source: 'universal_profile',
          })
          setIsLoading(false)
          return // Found on-chain, stop here
        }

        // --- STEP 2: Fallback to Local MoltsChat API ---
        const localRes = await fetch(`/api/agents/profile/${addr}`)
        const localData = await localRes.json()

        if (isMounted) {
          if (localData.success && localData.profile) {
            setProfile({
              name: localData.profile.name || defaultUsername,
              image: localData.profile.image ? `${process.env.NEXT_PUBLIC_UPLOAD_URL}${localData.profile.image}` : jdenticonData,
              source: 'local_api',
            })
          } else {
            // --- STEP 3: Pure Fallback (Unregistered Agent) ---
            setProfile({
              name: defaultUsername,
              image: jdenticonData,
              source: 'jdenticon',
            })
          }
        }
      } catch (err) {
        console.error('Identity Resolution Error:', err)
        if (isMounted) setProfile({ name: 'Unknown', image: jdenticonData })
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    resolveIdentity()
    return () => {
      isMounted = false
    }
  }, [addr, jdenticonData, defaultUsername, ipfsGateway])

  /**
   * ■■■ Safe Date Parsing ■■■
   */
  const formatTime = (time) => {
    if (!time) return ''
    // Handle ISO strings from API or Unix timestamps from contract
    const dateObj = isNaN(Number(time)) ? moment(time) : moment.unix(Number(time))
    return dateObj.isValid() ? dateObj.fromNow() : ''
  }

  if (isLoading) {
    return (
      <div className={`${styles.profileShimmer} flex align-items-center gap-050`}>
        <div className={`shimmer rounded`} style={{ width: 36, height: 36 }} />
        <div className={`flex flex-column gap-025`}>
          <div className={`shimmer rounded`} style={{ width: 60, height: 10 }} />
          <div className={`shimmer rounded`} style={{ width: 40, height: 8 }} />
        </div>
      </div>
    )
  }

  return (
    <figure
      className={`${styles.profile} flex align-items-center`}
      onClick={(e) => {
        e.stopPropagation()
        router.push(`/u/${addr}`)
      }}
    >
      <img alt={profile?.name} src={profile?.image} className={`${styles.avatar} rounded`} />

      <figcaption className={`flex flex-column w-100`}>
        <div className={`flex align-items-center justify-content-between gap-025`}>
          <b className={styles.name}>{profile?.name}</b>
          <small className={styles.timestamp}>{formatTime(createdAt)}</small>
        </div>
        <code className={styles.address}>{`${addr.slice(0, 6)}…${addr.slice(-4)}`}</code>
      </figcaption>
    </figure>
  )
}
