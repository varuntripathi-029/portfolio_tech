import { Scene } from './scene/Scene'
import { Overlay } from './ui/Overlay'

export default function App() {
  return (
    <div className="h-screen w-screen bg-carbon">
      <Scene />
      <Overlay />
    </div>
  )
}
