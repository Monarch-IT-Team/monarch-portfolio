import { useEffect, useRef } from 'react'
import styles from './Hero.module.css'

export default function Hero() {
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(40px)'
    const t = setTimeout(() => {
      el.style.transition = 'opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)'
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    }, 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <section className={styles.hero} id="home">
      {/* Nebula blobs */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />

      <div className="container">
        <div ref={textRef} className={styles.content}>
          {/* Crown icon */}
          <div className={styles.crownWrap}>
            <svg className={styles.crown} viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 44L12 16L24 28L32 8L40 28L52 16L60 44H4Z" fill="url(#goldGrad)" stroke="#f0c110" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="32" cy="8" r="3" fill="#f0c110" />
              <circle cx="12" cy="16" r="2.5" fill="#f0c110" />
              <circle cx="52" cy="16" r="2.5" fill="#f0c110" />
              <defs>
                <linearGradient id="goldGrad" x1="4" y1="8" x2="60" y2="48" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#f0c110" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#ffeaa0" stopOpacity="0.6" />
                </linearGradient>
              </defs>
            </svg>
            <div className={styles.crownGlow} />
          </div>

          {/* Main title */}
          <h1 className={`display-lg ${styles.title}`}>
            <span className="text-gold">MONARCH</span>
          </h1>

          {/* Subtitle */}
          <p className={`label-mono ${styles.subtitle}`}>
            Builder of Digital Empires
          </p>

          {/* Description */}
          <p className={styles.desc}>
            Создаю AI следующего поколения, образовательные платформы и интерактивные технологии.<br />
            От голосового интеллекта до Point Cloud графики — каждый проект это новая империя.
          </p>

          {/* CTA buttons */}
          <div className={styles.ctas}>
            <a href="#projects" className="btn-primary">
              <span>View Projects</span>
              <span>↓</span>
            </a>
            <a href="https://github.com/" target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <span>GitHub</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>

          {/* Stats row */}
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={`${styles.statNum} text-gold`}>4</span>
              <span className={styles.statLabel}>Projects</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={`${styles.statNum} text-nebula`}>1</span>
              <span className={styles.statLabel}>AI System</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={`${styles.statNum} text-gold`}>∞</span>
              <span className={styles.statLabel}>Ambition</span>
            </div>
          </div>
        </div>

      </div>

      {/* Scroll indicator */}
      <div className={styles.scrollIndicator}>
        <div className={styles.scrollLine} />
        <span className="label-mono" style={{ color: 'var(--outline)', fontSize: '10px' }}>scroll</span>
      </div>
    </section>
  )
}
