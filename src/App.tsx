import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ParticleCanvas from './components/ParticleCanvas'
import Home from './components/Home'
import StudyPlatform from './components/StudyPlatform'
import PointOfMonarch from './components/PointOfMonarch'

function App() {
  return (
    <BrowserRouter>
      <ParticleCanvas />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/study-platform" element={<StudyPlatform />} />
        <Route path="/point-of-monarch" element={<PointOfMonarch />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
