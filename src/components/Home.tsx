import Hero from './Hero'
import ProjectCard, { type Project } from './ProjectCard'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()

  const handleLaunchMonarch = async () => {
    try {
      // @ts-ignore
      await window.electron.launchMonarchAI()
    } catch (err) {
      console.error('Failed to launch Monarch AI:', err)
      // Fallback or show error
    }
  }

  const projects: Project[] = [
    {
      id: 'monarch-ai',
      number: '01',
      title: 'Monarch AI',
      subtitle: 'Voice AI Assistant',
      description: 'Голосовой AI-ассистент нового поколения с функцией обучения. Написан на Rust + Tauri с интеграцией локальных и облачных нейросетей.',
      tags: ['Rust', 'Tauri', 'AI', 'React'],
      accentColor: 'nebula',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
        </svg>
      ),
      action: {
        label: 'Launch App',
        onClick: handleLaunchMonarch
      }
    },
    {
      id: 'study-platform',
      number: '02',
      title: 'Study-Platform.uz',
      subtitle: 'Educational Platform',
      description: 'Полноценная образовательная платформа со встроенным AI-преподавателем (Monarch AI) и интерактивными курсами.',
      tags: ['Web', 'Education', 'AI API'],
      accentColor: 'teal',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
          <path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
      ),
      action: {
        label: 'Open Platform',
        onClick: () => navigate('/study-platform')
      }
    },
    {
      id: 'point-of-monarch',
      number: '03',
      title: 'Point of Monarch',
      subtitle: 'Point Cloud Technology',
      description: 'Интерактивная графическая 3D-презентация технологии Point Clouding. Поддерживает голосовое и сенсорное управление (Touchpad).',
      tags: ['Three.js', 'WebGL', 'Voice API'],
      accentColor: 'gold',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <circle cx="19" cy="5" r="2"/>
          <circle cx="5" cy="19" r="2"/>
          <path d="M13.5 10.5L17.5 6.5"/>
          <path d="M10.5 13.5L6.5 17.5"/>
        </svg>
      ),
      action: {
        label: 'Start Presentation',
        onClick: () => navigate('/point-of-monarch')
      }
    }
  ]

  return (
    <div style={{ position: 'relative', zIndex: 10 }}>
      <Hero />
      <section id="projects" className="container" style={{ paddingBottom: '120px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '24px' 
        }}>
          {projects.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </div>
      </section>
    </div>
  )
}
