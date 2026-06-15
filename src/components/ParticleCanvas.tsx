import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  color: string
  life: number
  maxLife: number
}

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const particles: Particle[] = []
    const COLORS = ['rgba(168,85,247,', 'rgba(255,255,255,', 'rgba(240,193,16,']

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }

    function spawnParticle(): Particle {
      const colorBase = COLORS[Math.floor(Math.random() * COLORS.length)]
      const maxLife = 200 + Math.random() * 400
      return {
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4 - 0.1,
        size: 0.5 + Math.random() * 1.5,
        opacity: 0,
        color: colorBase,
        life: 0,
        maxLife,
      }
    }

    function init() {
      for (let i = 0; i < 180; i++) {
        const p = spawnParticle()
        p.life = Math.random() * p.maxLife
        particles.push(p)
      }
    }

    function drawParticle(p: Particle) {
      const progress = p.life / p.maxLife
      // Fade in, hold, fade out
      const fade = progress < 0.2
        ? progress / 0.2
        : progress > 0.8
        ? (1 - progress) / 0.2
        : 1
      p.opacity = fade * (0.3 + Math.random() * 0.05)

      ctx!.beginPath()
      ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx!.fillStyle = `${p.color}${p.opacity.toFixed(2)})`
      ctx!.fill()

      // Glow for nebula/gold particles
      if (p.color !== COLORS[1] && p.opacity > 0.2) {
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
        ctx!.fillStyle = `${p.color}${(p.opacity * 0.1).toFixed(3)})`
        ctx!.fill()
      }
    }

    let frame = 0
    function animate() {
      rafRef.current = requestAnimationFrame(animate)
      frame++

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++

        if (p.life > p.maxLife) {
          particles.splice(i, 1)
          particles.push(spawnParticle())
          continue
        }

        // Mouse repel — gentle
        if (!prefersReducedMotion) {
          const dx = p.x - mx
          const dy = p.y - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120 && dist > 0) {
            const force = (120 - dist) / 120 * 0.3
            p.vx += (dx / dist) * force
            p.vy += (dy / dist) * force
          }
        }

        // Damping
        p.vx *= 0.99
        p.vy *= 0.99

        p.x += p.vx
        p.y += p.vy

        // Wrap
        if (p.x < 0) p.x = canvas!.width
        if (p.x > canvas!.width) p.x = 0
        if (p.y < 0) p.y = canvas!.height
        if (p.y > canvas!.height) p.y = 0

        drawParticle(p)
      }

      // Draw connecting lines between close particles (subtle)
      if (!prefersReducedMotion && frame % 2 === 0) {
        for (let i = 0; i < Math.min(particles.length, 80); i++) {
          for (let j = i + 1; j < Math.min(particles.length, 80); j++) {
            const dx = particles[i].x - particles[j].x
            const dy = particles[i].y - particles[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 80) {
              const alpha = (1 - dist / 80) * 0.06
              ctx!.beginPath()
              ctx!.moveTo(particles[i].x, particles[i].y)
              ctx!.lineTo(particles[j].x, particles[j].y)
              ctx!.strokeStyle = `rgba(168,85,247,${alpha.toFixed(3)})`
              ctx!.lineWidth = 0.5
              ctx!.stroke()
            }
          }
        }
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 }
    }

    resize()
    init()
    animate()

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
