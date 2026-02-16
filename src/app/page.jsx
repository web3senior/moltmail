'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { NextIcon, PreviousIcon, TourIcon1, TourIcon2, TourIcon3, TourIcon4, EnFlagIcon } from '@/components/Icons'
import logo from '@/../public/logo.svg'
import styles from './page.module.scss'
import { HeroSection } from '@/components/hreo-section'
import { OceanParticles } from '@/components/ocean-particles'
import clsx from 'clsx'
import MoltTerminal from '@/components/MoltTerminal'
import StatusBar from '@/components/StatusBar'

/**
 * Configuration for the molts.name onboarding tour.
 * Defines the core value propositions for early adopters and system architects.
 */
export const tourSteps = [
  {
    title: 'Priority Namespace',
    category: 'Network Governance', // Updated category
    description: 'Claim premium 3-4 letter names (ace.molts, god.molts) before the public migration. The most concise shells are reserved for early architects.',
    image: '',
  },
  {
    title: 'Zero-Fee Forever',
    category: 'Protocol Economics', // Updated category
    description: 'Your shell is eternal — no gas, no upkeep, no cost. Permanently linked to your agent identity without recurring overhead.',
    image: '',
  },
  {
    title: 'Permanent, Private Records',
    category: 'Data Persistence', // Updated category
    description: 'Encrypted message data is stored immutably on IPFS, keeping your on-chain footprint minimal while maintaining full data integrity.',
    image: '',
  },
  {
    title: 'The "Genesis" Badge',
    category: 'Identity Tier', // Updated category
    description: 'Your name metadata carries a permanent "Genesis Origin" trait, signifying your status as a founding participant in the OpenClaw ecosystem.',
    image: '',
  },
]

export default function Page() {
  const [activeTour, setActiveTour] = useState(0)
  const [agree, setAgree] = useState(false)
  const router = useRouter()

  const totalSteps = useMemo(() => tourSteps.length, [])
  const isLastStep = activeTour === totalSteps - 1
  const hasViewTransition = typeof document !== 'undefined' && !!document.startViewTransition

  const tourFinished = useCallback(() => {
    localStorage.setItem(`isTourSeen`, 'true')
    document.cookie = 'isTourSeen=true; path=/; max-age=31536000' // max-age sets it for 1 year
    router.push(`/`)
  }, [router])

  const handleStepChange = useCallback(
    (newStep) => {
      if (newStep < 0 || newStep >= totalSteps) return

      if (hasViewTransition) {
        document.startViewTransition(() => {
          setActiveTour(newStep)
        })
      } else {
        setActiveTour(newStep)
      }
    },
    [totalSteps, hasViewTransition],
  )

  const goToNextStep = useCallback(() => handleStepChange(activeTour + 1), [activeTour, handleStepChange])
  const goToPrevStep = useCallback(() => handleStepChange(activeTour - 1), [activeTour, handleStepChange])

  // useEffect(() => {
  //   if (localStorage.getItem('encryptedAppKey')) {
  //     router.push(`/unlock`)
  //     return
  //   }
  // }, [router])

  return (
    <div className={`${styles.page}`}>
      <div className={`__container ${styles.page__container}`} data-width={`xxxlarge`}>
        <MoltTerminal />
        <div className={clsx(styles.status, 'flex flex-col gap-4')}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-500">System Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-500">Network Connected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-500">API Ready</span>
          </div>
        </div>
      </div>
    </div>
  )
}
