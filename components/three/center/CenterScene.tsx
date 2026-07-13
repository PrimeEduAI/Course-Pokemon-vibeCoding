'use client'
import { Environment, OrbitControls, Stats } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import CardWall from './CardWall'
import CenterHall from './CenterHall'
import Pedestals from './Pedestals'
import type { CollectionCard, SummonRequest } from './types'

/** Suspense 完成後才會 mount → 通知外層「場景就緒」 */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => { onReady() }, [onReady])
  return null
}

/* 電影感巡航：~42 秒繞大廳一圈的橢圓軌道，拖曳即接手、雙擊回巡航 */
function TourRig({ touring, controls }: { touring: boolean; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const t = useRef(0)
  const tmp = useRef(new Vector3())
  useFrame(({ camera }, dt) => {
    if (!touring || !controls.current) return
    if (dt > 0.5) dt = 0.016 // 資產載入的長幀不推進巡航
    t.current += dt
    const a = t.current * ((Math.PI * 2) / 42)
    tmp.current.set(
      Math.sin(a) * 8.3,
      3.15 + Math.sin(t.current * 0.32) * 0.45,
      Math.cos(a) * 6.4 + 0.4,
    )
    camera.position.lerp(tmp.current, Math.min(1, dt * 1.6))
    controls.current.target.lerp(new Vector3(0, 1.55, -1.4), Math.min(1, dt * 2.2))
    controls.current.update()
  })
  return null
}

export default function CenterScene({
  cards, empty, summon, onSelectCard,
}: {
  cards: CollectionCard[]
  empty: boolean
  summon: SummonRequest | null
  onSelectCard: (c: CollectionCard) => void
}) {
  const [touring, setTouring] = useState(true)
  const [ready, setReady] = useState(false)
  const controls = useRef<OrbitControlsImpl | null>(null)
  const showStats = typeof window !== 'undefined' && window.location.search.includes('stats')

  return (
    <>
    <Canvas
      shadows
      camera={{ position: [0, 3.2, 6.9], fov: 50 }}
      dpr={[1, 1.75]}
      onDoubleClick={() => setTouring(true)}
    >
      {showStats && <Stats />}
      <color attach="background" args={['#080810']} />
      <fog attach="fog" args={['#0b0a10', 18, 44]} />

      <Suspense fallback={null}>
        {/* 夜景 IBL 只做反射 */}
        <Environment files="/assets/hdri/shanghai_bund_2k.hdr" environmentIntensity={0.12} />

        {/* 暖色主光（唯一大範圍投影光） */}
        <directionalLight
          position={[3, 9.5, 2.5]}
          intensity={0.45}
          color="#ffdcae"
          castShadow
          shadow-mapSize={[1536, 1536]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-camera-far={30}
          shadow-bias={-0.0004}
        />
        <hemisphereLight args={['#4a3d46', '#181009', 0.26]} />
        <ambientLight intensity={0.07} color="#a08668" />

        <CenterHall />
        <CardWall cards={cards} onSelect={onSelectCard} />
        <Pedestals empty={empty} summon={summon} />

        <EffectComposer>
          <Bloom mipmapBlur intensity={0.42} luminanceThreshold={0.75} luminanceSmoothing={0.25} />
          <Vignette eskil={false} offset={0.2} darkness={0.72} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
        <Ready onReady={() => setReady(true)} />
      </Suspense>

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableDamping
        minDistance={3.2}
        maxDistance={9.6}
        minPolarAngle={0.55}
        maxPolarAngle={1.52}
        target={[0, 1.55, -1.4]}
        onStart={() => setTouring(false)}
      />
      <TourRig touring={touring && ready} controls={controls} />
    </Canvas>
    {/* 資產載入面紗：Suspense 完成後淡出 */}
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
        display: 'grid', placeItems: 'center', background: '#080810',
        opacity: ready ? 0 : 1, transition: 'opacity 1.1s ease',
        color: '#ff8a5c', fontFamily: 'DotGothic16, monospace', fontSize: 18, letterSpacing: 3,
      }}
    >
      <span style={{ animation: ready ? undefined : 'pulse 1.6s ease-in-out infinite' }}>
        點亮寶可夢中心…
      </span>
    </div>
    </>
  )
}
