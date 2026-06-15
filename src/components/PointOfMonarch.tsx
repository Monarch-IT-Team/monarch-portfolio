import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'

const MAX_POINTS = 600
const MAX_LINES = MAX_POINTS * 6

// ─── Shape Positions ──────────────────────────────────────────────────────────
function getShapePosition(shape: string, i: number, n: number): THREE.Vector3 {
  const t = i / n // 0..1 normalized

  if (shape === 'chair') {
    // Distribute: 40% legs, 30% seat, 30% back
    if (t < 0.4) {
      // 4 legs
      const leg = Math.floor(t / 0.1) // 0,1,2,3
      const legProgress = (t % 0.1) / 0.1
      const lx = leg < 2 ? -0.8 : 0.8
      const lz = leg % 2 === 0 ? -0.6 : 0.6
      return new THREE.Vector3(lx + (Math.random() - 0.5) * 0.12, -2 + legProgress * 1.4, lz + (Math.random() - 0.5) * 0.12)
    } else if (t < 0.7) {
      // Seat (flat horizontal plane)
      return new THREE.Vector3((Math.random() - 0.5) * 1.8, -0.6 + (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 1.3)
    } else {
      // Back support (vertical plane)
      return new THREE.Vector3((Math.random() - 0.5) * 1.8, -0.6 + (t - 0.7) / 0.3 * 2.0, -0.65 + (Math.random() - 0.5) * 0.1)
    }
  }

  if (shape === 'atom') {
    if (t < 0.2) {
      // Nucleus - dense sphere
      const r = Math.random() * 0.45
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      return new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi))
    }
    // 3 electron shells / orbits
    const shell = Math.floor(((t - 0.2) / 0.8) * 3)
    const radius = (shell + 1) * 1.5
    const angle = t * Math.PI * 60 + shell * Math.PI / 3
    const tilt = shell * 0.6
    const x = radius * Math.cos(angle)
    const y = radius * Math.sin(angle) * Math.cos(tilt)
    const z = radius * Math.sin(angle) * Math.sin(tilt)
    return new THREE.Vector3(x, y, z)
  }

  if (shape === 'sphere') {
    const phi = Math.acos(1 - 2 * (i / n))
    const theta = Math.PI * (1 + Math.sqrt(5)) * i
    const r = 2.0
    return new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi))
  }

  // network / default — random cloud
  return new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4)
}

// ─── OpenRouter AI (Generative 3D Point Cloud) ──────────────────────────────────
async function generateShapeFromAI(transcript: string): Promise<{ shape: string; points: number[][] } | { error: string }> {
  const KEY = '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'
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openrouter/free',
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Ты умный 3D-генератор форм. Пользователь называет форму.
Твоя задача — напрямую сгенерировать 3D облако точек для этой формы.

Правила:
- Сгенерируй от 250 до 350 точек (координат [x, y, z]), которые визуально образуют запрошенный объект.
- Все координаты должны быть в диапазоне от -2.0 до 2.0.
- Не пиши код. Верни СТРОГО JSON формат с полями "shape" (название фигуры, 1 слово) и "points" (массив массивов чисел).
- Старайся сделать форму реалистичной и узнаваемой, распределяя точки по контурам объекта.

Пример ответа:
{"shape":"tree","points":[[0,-1,0],[0,-0.8,0],[0.2,0.5,0.1],[-0.3,0.8,-0.2]]}`
          },
          {
            role: 'user',
            content: `Сгенерируй JSON для указанной формы: ${transcript}`
          }
        ]
      })
    })
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (content) {
      console.log('AI Raw response:', content.slice(0, 100) + '... (truncated)')
      
      let jsonString = content.trim()
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '')
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```\n?/, '').replace(/\n?```$/, '')
      }
      
      const parsed = JSON.parse(jsonString)
      if (parsed.shape && Array.isArray(parsed.points)) return parsed
      return { error: 'Invalid format: missing shape or points' }
    }
    return { error: 'No content from API: ' + JSON.stringify(data).slice(0, 50) }
  } catch (e: any) {
    console.error('AI shape generation failed:', e)
    return { error: e.message || String(e) }
// ─── PointCloud 3D ────────────────────────────────────────────────────────────
function PointCloud({
  phase, density, rotationSpeed, shape, touchRotateDelta, learnedShapes
}: {
  phase: number
  density: number
  rotationSpeed: number
  shape: string
  touchRotateDelta: { x: number; y: number }
  learnedShapes: Record<string, number[][]>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)

  const active = phase === 0 ? 1 : Math.floor(MAX_POINTS * density)

  // Stable geometry objects - created once
  const pointGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3))
    return g
  }, [])

  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LINES * 3), 3))
    return g
  }, [])

  // Target positions (where we want points to go)
  const targetPos = useRef(new Float32Array(MAX_POINTS * 3).fill(0))
  // Current positions (animated toward target)
  const currentPos = useRef(new Float32Array(MAX_POINTS * 3).fill(0))

  // Recompute target positions when shape/phase/density changes
  useEffect(() => {
    const n = Math.floor(MAX_POINTS * density)

    for (let i = 0; i < MAX_POINTS; i++) {
      if (phase === 0 || i >= n) {
        targetPos.current[i * 3] = 0
        targetPos.current[i * 3 + 1] = 0
        targetPos.current[i * 3 + 2] = 0
        continue
      }

      let v: THREE.Vector3
      if (learnedShapes[shape] && learnedShapes[shape].length > 0) {
        const pts = learnedShapes[shape]
        const p = pts[i % pts.length]
        
        // Add tiny noise so repeated points form a thicker volume instead of exact overlaps
        const noise = i >= pts.length ? 0.08 : 0
        v = new THREE.Vector3(
          p[0] + (Math.random() - 0.5) * noise,
          p[1] + (Math.random() - 0.5) * noise,
          p[2] + (Math.random() - 0.5) * noise
        )
      } else {
        v = getShapePosition(shape, i, n)
      }

      targetPos.current[i * 3] = v.x
      targetPos.current[i * 3 + 1] = v.y
      targetPos.current[i * 3 + 2] = v.z
    }
  }, [phase, shape, density, learnedShapes])

  useFrame((_state, delta) => {
    if (!pointsRef.current || !linesRef.current || !groupRef.current) return

    // Auto rotation
    groupRef.current.rotation.y += delta * rotationSpeed

    // Touchpad-driven extra rotation
    if (Math.abs(touchRotateDelta.x) > 0.001 || Math.abs(touchRotateDelta.y) > 0.001) {
      groupRef.current.rotation.y += touchRotateDelta.x * 0.05
      groupRef.current.rotation.x += touchRotateDelta.y * 0.05
    }

    const posArr = pointsRef.current.geometry.attributes.position.array as Float32Array
    const lerpSpeed = 4 * delta

    for (let i = 0; i < MAX_POINTS * 3; i++) {
      const diff = targetPos.current[i] - currentPos.current[i]
      currentPos.current[i] += diff * lerpSpeed
      posArr[i] = currentPos.current[i]
    }
    pointsRef.current.geometry.setDrawRange(0, active)
    pointsRef.current.geometry.attributes.position.needsUpdate = true

    // Lines
    if (phase >= 2) {
      const lp = linesRef.current.geometry.attributes.position.array as Float32Array
      let li = 0
      const limit = Math.min(active, MAX_POINTS)
      for (let i = 0; i < limit && li < MAX_LINES * 3 - 12; i++) {
        for (let j = i + 1; j < Math.min(i + 4, limit); j++) {
          lp[li++] = currentPos.current[i * 3]
          lp[li++] = currentPos.current[i * 3 + 1]
          lp[li++] = currentPos.current[i * 3 + 2]
          lp[li++] = currentPos.current[j * 3]
          lp[li++] = currentPos.current[j * 3 + 1]
          lp[li++] = currentPos.current[j * 3 + 2]
        }
      }
      linesRef.current.geometry.setDrawRange(0, li / 3)
      linesRef.current.geometry.attributes.position.needsUpdate = true
      linesRef.current.visible = true
    } else {
      linesRef.current.visible = false
    }
  })

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={pointGeo}>
        <pointsMaterial size={0.1} color="#f0c110" transparent opacity={0.9} sizeAttenuation />
      </points>
      <lineSegments ref={linesRef} geometry={lineGeo}>
        <lineBasicMaterial color="#a855f7" transparent opacity={0.3} />
      </lineSegments>
    </group>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PointOfMonarch() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState(0)
  const [density, setDensity] = useState(0.6)
  const [rotationSpeed, setRotationSpeed] = useState(0.2)
  const [shape, setShape] = useState('network')
  const [isListening, setIsListening] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [showSliders, setShowSliders] = useState(true)
  const [learnedShapes, setLearnedShapes] = useState<Record<string, number[][]>>({})
  const [learnedList, setLearnedList] = useState<string[]>([])

  // Touchpad
  const [touchRotateDelta, setTouchRotateDelta] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey) {
        const delta = e.deltaY > 0 ? -0.05 : 0.05
        setDensity(d => Math.max(0.1, Math.min(1, d + delta)))
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const delta = e.deltaX > 0 ? 0.05 : -0.05
        setRotationSpeed(s => Math.max(0, Math.min(3, s + delta)))
      } else {
        setTouchRotateDelta({ x: e.deltaX * 0.01, y: e.deltaY * 0.01 })
        setTimeout(() => setTouchRotateDelta({ x: 0, y: 0 }), 100)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setPhase(p => Math.min(p + 1, 3)) }
      if (e.key === '1') { setShape('network'); setPhase(2) }
      if (e.key === '2') { setShape('chair'); setPhase(3) }
      if (e.key === '3') { setShape('atom'); setPhase(3) }
      if (e.key === '4') { setShape('sphere'); setPhase(3) }
      if (e.key === 'r') setRotationSpeed(s => s > 0 ? 0 : 0.3)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Voice recording (Web Speech API → OpenRouter) ──
  useEffect(() => {
    if (!isListening) return

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setStatusMsg('❌ Speech Recognition API не поддерживается в этом браузере')
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'ru-RU'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setStatusMsg('🎙️ Говорите... (слушаю)')
    }

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript
      setStatusMsg('🤖 ИИ анализирует: ' + transcript)
      
      try {
        const result = await generateShapeFromAI(transcript)

        if (!result || 'error' in result || !result.points || result.points.length === 0) {
          const errMsg = 'error' in result ? result.error : 'Не понял форму, попробуй ещё'
          setStatusMsg('❓ ' + errMsg)
        } else {
          const { shape: shapeName, points } = result as { shape: string, points: number[][] }
          setLearnedShapes(prev => ({ ...prev, [shapeName]: points }))
          setLearnedList(prev => prev.includes(shapeName) ? prev : [...prev, shapeName])
          setShape(shapeName)
          setPhase(3)
          setStatusMsg(`✅ Форма «${shapeName}» создана!`)
        }
      } catch (e: any) {
        console.error(e)
        setStatusMsg('❌ Ошибка: ' + e.message)
      }

      setTimeout(() => setStatusMsg(''), 4000)
      setIsListening(false)
    }

    recognition.onerror = (event: any) => {
      setStatusMsg('❌ Ошибка микрофона: ' + event.error)
      setTimeout(() => setStatusMsg(''), 3000)
      setIsListening(false)
    }

    recognition.onnomatch = () => {
      setStatusMsg('❓ Речь не распознана')
      setTimeout(() => setStatusMsg(''), 3000)
      setIsListening(false)
    }
    
    recognition.onend = () => {
      // In case it ends without result or error
      if (isListening) setIsListening(false)
    }

    try {
      recognition.start()
    } catch (e) {
      setStatusMsg('❌ Ошибка запуска микрофона')
      setIsListening(false)
    }

    return () => {
      try { recognition.stop() } catch (e) {}
    }
  }, [isListening])

  const builtinShapes = [
    { key: 'network', label: 'Сеть', emoji: '🔗' },
    { key: 'chair', label: 'Стул', emoji: '🪑' },
    { key: 'atom', label: 'Атом', emoji: '⚛' },
    { key: 'sphere', label: 'Сфера', emoji: '🌐' },
  ]

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', width: '100vw', height: '100vh',
        background: 'radial-gradient(ellipse at center, #0d0d2b 0%, #050510 100%)',
        overflow: 'hidden', userSelect: 'none'
      }}
    >
      {/* ── Header ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 52,
        background: 'rgba(5,5,20,0.9)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(168,85,247,0.2)',
        display: 'flex', alignItems: 'center', padding: '0 20px', zIndex: 20, gap: 16
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', cursor: 'pointer', borderRadius: 8,
          padding: '6px 14px', fontSize: 13
        }}>
          ← Назад
        </button>
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(168,85,247,0.8)', letterSpacing: 2 }}>
          POINT OF MONARCH
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Built-in shapes */}
          {builtinShapes.map(b => (
            <button key={b.key} onClick={() => { setShape(b.key); setPhase(b.key === 'network' ? 2 : 3) }}
              style={{
                background: shape === b.key ? 'rgba(168,85,247,0.25)' : 'transparent',
                border: `1px solid ${shape === b.key ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.1)'}`,
                color: '#fff', cursor: 'pointer', borderRadius: 8,
                padding: '5px 12px', fontSize: 12, transition: 'all 0.2s'
              }}
            >
              {b.emoji} {b.label}
            </button>
          ))}
          {/* Learned (AI-generated) shapes */}
          {learnedList.map(name => (
            <button key={name} onClick={() => { setShape(name); setPhase(3) }}
              style={{
                background: shape === name ? 'rgba(240,193,16,0.25)' : 'rgba(240,193,16,0.05)',
                border: `1px solid ${shape === name ? 'rgba(240,193,16,0.6)' : 'rgba(240,193,16,0.2)'}`,
                color: '#f0c110', cursor: 'pointer', borderRadius: 8,
                padding: '5px 12px', fontSize: 12, transition: 'all 0.2s'
              }}
            >
              ✨ {name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Left Panel ── */}
      <div style={{ position: 'absolute', top: 64, left: 16, zIndex: 15, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => setShowSliders(s => !s)} style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.5)', cursor: 'pointer', borderRadius: 8, padding: '5px 10px', fontSize: 11
        }}>
          {showSliders ? '◀ Скрыть' : '▶ Панель'}
        </button>

        {showSliders && (
          <div style={{
            background: 'rgba(10,10,30,0.88)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(168,85,247,0.18)', borderRadius: 16,
            padding: 16, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 220
          }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>⚙️ Управление</div>

            {/* Phase */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Фаза</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2, 3].map(p => (
                  <button key={p} onClick={() => setPhase(p)} style={{
                    flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                    background: phase === p ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${phase === p ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    color: '#fff'
                  }}>
                    {p === 0 ? '●' : p === 1 ? '··' : p === 2 ? '⬡' : '✦'}
                  </button>
                ))}
              </div>
            </div>

            {/* Density */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Плотность</span>
                <span style={{ fontSize: 11, color: '#f0c110', fontFamily: 'monospace' }}>{Math.round(density * 100)}%</span>
              </div>
              <input type="range" min="0.1" max="1" step="0.05" value={density}
                onChange={e => setDensity(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#f0c110' }} />
            </label>

            {/* Rotation */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Вращение</span>
                <span style={{ fontSize: 11, color: '#a855f7', fontFamily: 'monospace' }}>{rotationSpeed.toFixed(1)}</span>
              </div>
              <input type="range" min="0" max="3" step="0.1" value={rotationSpeed}
                onChange={e => setRotationSpeed(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#a855f7' }} />
            </label>

            {/* Voice */}
            <button onClick={() => setIsListening(l => !l)} style={{
              padding: '10px 0', borderRadius: 10, cursor: 'pointer',
              background: isListening ? 'rgba(239,68,68,0.2)' : 'rgba(168,85,247,0.15)',
              border: `1px solid ${isListening ? 'rgba(239,68,68,0.5)' : 'rgba(168,85,247,0.3)'}`,
              color: '#fff', fontSize: 13, fontWeight: 600,
              animation: isListening ? 'pulse 1.5s infinite' : 'none'
            }}>
              {isListening ? '🔴 Слушаю...' : '🎙️ Голос'}
            </button>

            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6 }}>
              Скажи «изобрази собаку»<br />
              «нарисуй дерево»<br />
              «сделай ракету»
            </div>
          </div>
        )}
      </div>

      {/* ── Status toast ── */}
      {statusMsg && (
        <div style={{
          position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,30,0.97)', border: '1px solid rgba(168,85,247,0.4)',
          color: '#fff', borderRadius: 10, padding: '8px 24px', fontSize: 13,
          zIndex: 30, fontFamily: 'monospace', backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease', whiteSpace: 'nowrap'
        }}>
          {statusMsg}
        </div>
      )}

      {/* ── Current shape label ── */}
      <div style={{
        position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(168,85,247,0.5)', fontSize: 11, fontFamily: 'monospace', letterSpacing: 2
      }}>
        {shape.toUpperCase()} | фаза {phase}
      </div>

      {/* ── Hints ── */}
      <div style={{
        position: 'absolute', bottom: 20, right: 20, zIndex: 15,
        color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'right', lineHeight: 1.8
      }}>
        <div>🖐 Тачпад: 2 пальца → вращение</div>
        <div>🤏 Щипок → плотность</div>
        <div>↔️ Свайп → скорость вращения</div>
        <div style={{ marginTop: 6 }}>⌨️ 1-4 = форма &nbsp; Пробел = фаза &nbsp; R = стоп</div>
      </div>

      {/* ── 3D Canvas ── */}
      <Canvas camera={{ position: [0, 0, 7], fov: 55 }} style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <PointCloud
          phase={phase}
          density={density}
          rotationSpeed={rotationSpeed}
          shape={shape}
          touchRotateDelta={touchRotateDelta}
          learnedShapes={learnedShapes}
        />
        <OrbitControls enablePan enableZoom enableRotate makeDefault />
        {phase === 0 && (
          <Text position={[0, -0.8, 0]} fontSize={0.18} color="rgba(255,255,255,0.3)" anchorX="center" anchorY="middle">
            Единая точка
          </Text>
        )}
      </Canvas>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
        @keyframes fadeIn { from { opacity:0; transform:translateX(-50%) translateY(-8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  )
}
