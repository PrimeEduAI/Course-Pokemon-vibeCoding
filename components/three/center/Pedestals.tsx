'use client'
import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, DoubleSide, Group, MathUtils, MeshStandardMaterial, Object3D, SpotLight as ThreeSpotLight } from 'three'
import ShowpieceModel from './ShowpieceModel'
import { lightShaftTexture } from './textures'
import type { SummonRequest } from './types'

const FONT_CJK = '/assets/fonts/DotGothic16-Regular.ttf'

/** 指向 target 的聚光燈 + 假體積光錐 */
function StageSpot({
  x, z, color = '#ffd9a8', lightRef, baseIntensity = 90, castShadow = false,
}: {
  x: number; z: number; color?: string
  lightRef?: React.MutableRefObject<ThreeSpotLight | null>
  baseIntensity?: number
  castShadow?: boolean
}) {
  const [target] = useState(() => new Object3D())
  const shaft = lightShaftTexture()
  const inner = useRef<ThreeSpotLight>(null)
  return (
    <group>
      <spotLight
        ref={(l) => { inner.current = l; if (lightRef) lightRef.current = l }}
        position={[x, 5.6, z + 0.4]}
        angle={0.46}
        penumbra={0.65}
        decay={1.8}
        distance={11}
        intensity={baseIntensity}
        color={color}
        castShadow={castShadow}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        target={target}
      />
      <primitive object={target} position={[x, 0, z]} />
      {/* 假體積光錐（上亮下淡） */}
      <mesh position={[x, 2.9, z + 0.2]} rotation-x={0.04}>
        <coneGeometry args={[1.45, 5.4, 26, 1, true]} />
        <meshBasicMaterial
          map={shaft} color={color} transparent opacity={0.035}
          blending={AdditiveBlending} depthWrite={false} side={DoubleSide}
        />
      </mesh>
    </group>
  )
}

function Pedestal({
  x, z, r = 1.05, ringMat,
}: { x: number; z: number; r?: number; ringMat?: MeshStandardMaterial }) {
  const defaultRing = useMemo(
    () => new MeshStandardMaterial({ color: '#ffdf9e', emissive: '#ffb45e', emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.5 }),
    [],
  )
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.045, 0]} receiveShadow>
        <cylinderGeometry args={[r + 0.28, r + 0.34, 0.09, 36]} />
        <meshStandardMaterial color="#2c2732" roughness={0.55} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r + 0.06, 0.17, 36]} />
        <meshStandardMaterial color="#43394a" roughness={0.4} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.262, 0]} rotation-x={Math.PI / 2} material={ringMat ?? defaultRing}>
        <torusGeometry args={[r - 0.09, 0.026, 10, 40]} />
      </mesh>
    </group>
  )
}

function SpinIn({ children, speed = 0.15 }: { children: React.ReactNode; speed?: number }) {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * speed
    const s = MathUtils.lerp(ref.current.scale.x, 1, Math.min(1, dt * 3.2))
    ref.current.scale.setScalar(s)
  })
  return <group ref={ref} scale={0.01}>{children}</group>
}

/** 空收藏時：三隻迎賓寶可夢輪流被聚光燈點亮 */
function WelcomeTrio() {
  const trio = [
    { dexId: 25, name: '皮卡丘', x: 0, z: -0.7, color: '#ffe08a' },
    { dexId: 6, name: '噴火龍', x: -2.7, z: 1.1, color: '#ffc38a' },
    { dexId: 658, name: '甲賀忍蛙', x: 2.7, z: 1.1, color: '#7fd4e8' },
  ]
  const lights = [useRef<ThreeSpotLight | null>(null), useRef<ThreeSpotLight | null>(null), useRef<ThreeSpotLight | null>(null)]
  const groups = [useRef<Group>(null), useRef<Group>(null), useRef<Group>(null)]
  const ringMats = useMemo(
    () => trio.map((t) => new MeshStandardMaterial({
      color: '#ffdf9e', emissive: t.color, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.5,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame(({ clock }, dt) => {
    const active = Math.floor(clock.elapsedTime / 4.4) % 3
    const k = Math.min(1, dt * 2.5)
    trio.forEach((_, i) => {
      const on = i === active
      const l = lights[i].current
      if (l) l.intensity = MathUtils.lerp(l.intensity, on ? 115 : 20, k)
      const g = groups[i].current
      if (g) g.rotation.y += dt * (on ? 0.55 : 0.1)
      ringMats[i].emissiveIntensity = MathUtils.lerp(ringMats[i].emissiveIntensity, on ? 2.4 : 0.55, k)
    })
  })

  return (
    <group>
      {trio.map((t, i) => (
        <group key={t.dexId}>
          <Pedestal x={t.x} z={t.z} ringMat={ringMats[i]} />
          <StageSpot x={t.x} z={t.z} color={t.color} lightRef={lights[i]} baseIntensity={26} castShadow={i === 0} />
          <group position={[t.x, 0.36, t.z]}>
            <group ref={groups[i]}>
              <Suspense fallback={null}>
                <ShowpieceModel dexId={t.dexId} targetHeight={1.3} />
              </Suspense>
            </group>
            <Billboard position={[0, -0.06, 1.18]}>
              <Text font={FONT_CJK} fontSize={0.15} color="#f0e6d2" anchorX="center" anchorY="middle" outlineWidth={0.007} outlineColor="#201a14">
                {t.name}
              </Text>
            </Billboard>
          </group>
        </group>
      ))}
    </group>
  )
}

/** 召喚台：中央單一底座；有召喚時載入該寶可夢並打光 */
export default function Pedestals({ empty, summon }: { empty: boolean; summon: SummonRequest | null }) {
  if (summon) {
    return (
      <group>
        <Pedestal x={0} z={0.2} r={1.2} />
        <StageSpot x={0} z={0.2} baseIntensity={170} castShadow />
        <group position={[0, 0.36, 0.2]}>
          <SpinIn key={summon.key} speed={0.35}>
            <Suspense fallback={null}>
              <ShowpieceModel dexId={summon.dexId} targetHeight={1.4} />
            </Suspense>
          </SpinIn>
        </group>
      </group>
    )
  }
  if (empty) return <WelcomeTrio />
  // 有收藏但尚未召喚：安靜的空舞台等待
  return (
    <group>
      <Pedestal x={0} z={0.2} r={1.2} />
      <StageSpot x={0} z={0.2} baseIntensity={40} />
    </group>
  )
}
