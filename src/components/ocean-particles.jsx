'use client'

import { useEffect, useRef } from 'react'
import styles from './OceanParticles.module.scss'
import clsx from 'clsx'
/**
 * OceanParticles — Ambient floating particles that simulate bioluminescent
 * organisms drifting through the deep ocean. Drawn on a full-screen canvas
 * behind the main ritual card to reinforce the "ocean floor" atmosphere.
 */
export function OceanParticles() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    /* Size the canvas to fill the viewport */
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    /* Particle definition — each speck is a point of light with its own
       speed, size, and opacity to create depth-of-field variation */
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speedY: -(Math.random() * 0.3 + 0.1),
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.5 + 0.1,
    }))

    let animationId

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        /* Move particle upward — like bubbles rising from the abyss */
        p.y += p.speedY
        p.x += p.speedX

        /* Wrap particle back to the bottom when it exits the top */
        if (p.y < -10) {
          p.y = canvas.height + 10
          p.x = Math.random() * canvas.width
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(248, 49, 47, ${p.opacity})`
        ctx.fill()
      }

      animationId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className={clsx(styles.oceanParticlesCanvas)} />
}
