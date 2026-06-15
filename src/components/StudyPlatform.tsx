import { useNavigate } from 'react-router-dom'

export default function StudyPlatform() {
  const navigate = useNavigate()

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', zIndex: 20, backgroundColor: '#0a0a1a' }}>
      {/* Header bar */}
      <div style={{ 
        position: 'absolute', top: 0, left: 0, right: 0, height: '48px', 
        background: 'rgba(10, 10, 26, 0.8)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', padding: '0 24px', zIndex: 21,
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <button 
          onClick={() => navigate('/')}
          style={{
            background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-headline)',
            fontSize: '14px', fontWeight: 600
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Portfolio
        </button>
        <div style={{ margin: '0 auto', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--outline)' }}>
          study-platform.uz
        </div>
      </div>

      {/* Browser Frame */}
      <iframe 
        src="https://study-platform.uz" 
        style={{ width: '100%', height: '100%', border: 'none', paddingTop: '48px' }}
        title="Study Platform"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        allow="cross-origin-isolated; fullscreen; microphone; camera; display-capture"
      />
    </div>
  )
}
