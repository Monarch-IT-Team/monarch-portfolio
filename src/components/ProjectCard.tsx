import styles from './ProjectCard.module.css'

export interface Project {
  id: string
  number: string
  title: string
  subtitle: string
  description: string
  tags: string[]
  accentColor: 'nebula' | 'gold' | 'teal' | 'blue'
  icon: React.ReactNode
  action: {
    label: string
    href?: string
    onClick?: () => void
    isExternal?: boolean
  }
  secondaryAction?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

interface ProjectCardProps {
  project: Project
  index: number
}

const ACCENT_COLORS = {
  nebula: { primary: '#a855f7', glow: 'rgba(168,85,247,0.35)', dim: 'rgba(168,85,247,0.1)' },
  gold:   { primary: '#f0c110', glow: 'rgba(240,193,16,0.35)',  dim: 'rgba(240,193,16,0.1)' },
  teal:   { primary: '#2dd4bf', glow: 'rgba(45,212,191,0.35)',  dim: 'rgba(45,212,191,0.1)' },
  blue:   { primary: '#60a5fa', glow: 'rgba(96,165,250,0.35)',  dim: 'rgba(96,165,250,0.1)' },
}

export default function ProjectCard({ project, index }: ProjectCardProps) {
  const accent = ACCENT_COLORS[project.accentColor]

  const style = {
    '--accent': accent.primary,
    '--accent-glow': accent.glow,
    '--accent-dim': accent.dim,
    animationDelay: `${index * 120}ms`,
  } as React.CSSProperties

  const handleAction = () => {
    if (project.action.href) {
      if (project.action.isExternal) {
        window.open(project.action.href, '_blank', 'noopener,noreferrer')
      } else {
        window.location.href = project.action.href
      }
    } else if (project.action.onClick) {
      project.action.onClick()
    }
  }

  const handleSecondary = () => {
    if (project.secondaryAction?.href) {
      window.open(project.secondaryAction.href, '_blank', 'noopener,noreferrer')
    } else if (project.secondaryAction?.onClick) {
      project.secondaryAction.onClick()
    }
  }

  return (
    <article className={styles.card} style={style}>
      {/* Number badge */}
      <div className={styles.number}>
        <span className="label-mono">{project.number}</span>
      </div>

      {/* Icon area */}
      <div className={styles.iconWrap}>
        <div className={styles.iconBg} />
        <div className={styles.icon}>{project.icon}</div>
      </div>

      {/* Content */}
      <div className={styles.body}>
        <div>
          <h3 className={styles.title}>{project.title}</h3>
          <p className={styles.subtitle}>{project.subtitle}</p>
        </div>
        <p className={styles.desc}>{project.description}</p>

        {/* Tags */}
        <div className={styles.tags}>
          {project.tags.map(tag => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.btnPrimary} onClick={handleAction}>
          {project.action.label}
          {project.action.isExternal && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          )}
          {!project.action.isExternal && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          )}
        </button>

        {project.secondaryAction && (
          <button className={styles.btnSecondary} onClick={handleSecondary}>
            {project.secondaryAction.label}
          </button>
        )}
      </div>

      {/* Hover glow overlay */}
      <div className={styles.hoverGlow} />
    </article>
  )
}
