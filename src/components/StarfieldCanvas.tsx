'use client'
import { useEffect, useRef } from 'react'

export default function StarfieldCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    if (!ctx) return

    let w = 0, h = 0, animId = 0
    const BLUE = [27, 110, 230]

    interface Star { x: number; y: number; r: number; baseO: number; phase: number; speed: number; color: number[] }
    const stars: Star[] = []

    function resize() {
      if (!c) return
      w = c.width = window.innerWidth
      h = c.height = window.innerHeight
    }

    function init() {
      resize()
      stars.length = 0
      for (let i = 0; i < 500; i++) {
        const rng = Math.random()
        const color = rng < 0.05 ? BLUE : rng < 0.15 ? [27, 110, 230] : [255, 255, 255]
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.2 + 0.3,
          baseO: rng < 0.05 ? Math.random() * 0.4 + 0.2 : Math.random() * 0.2 + 0.05,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.003 + 0.001,
          color,
        })
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        s.phase += s.speed
        const o = s.baseO * (0.6 + Math.sin(s.phase) * 0.4)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${o})`
        ctx.fill()
      }
      animId = requestAnimationFrame(draw)
    }

    init()
    draw()
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', width: '100%', height: '100%' }} />
}
