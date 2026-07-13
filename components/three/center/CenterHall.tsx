'use client'
import { MeshReflectorMaterial, RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, DoubleSide, MeshStandardMaterial, Points } from 'three'
import {
  centerSignTexture, deskEmblemTexture, lightShaftTexture,
  nightWindowTexture, pcScreenTexture,
} from './textures'

/* 房間尺寸：x ±11 · z ±9.2 · 高 6.6 */
const W = 22.6
const D = 18.8
const H = 6.6

const CREAM = '#d8c5a4'
const RED = '#c8323e'
const WARM_BULB = '#ffb45e'

function Walls() {
  return (
    <group>
      {/* 地板：拋光反射 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <MeshReflectorMaterial
          resolution={512}
          blur={[280, 70]}
          mixBlur={0.75}
          mixStrength={5.5}
          mirror={0.55}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          roughness={0.5}
          metalness={0.25}
          color="#6b584a"
        />
      </mesh>
      {/* 紅地毯：櫃台走道 + 中央圓毯 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, -4.2]}>
        <planeGeometry args={[2.8, 6.6]} />
        <meshStandardMaterial color="#8e2733" roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.014, 0.2]}>
        <circleGeometry args={[2.55, 40]} />
        <meshStandardMaterial color="#8e2733" roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0.2]}>
        <ringGeometry args={[2.4, 2.55, 40]} />
        <meshStandardMaterial color="#e8c17a" roughness={0.4} metalness={0.5} emissive="#8a6a2c" emissiveIntensity={0.35} />
      </mesh>

      {/* 四面牆 */}
      <mesh position={[0, H / 2, -D / 2]} receiveShadow>
        <boxGeometry args={[W, H, 0.3]} />
        <meshStandardMaterial color={CREAM} roughness={0.9} />
      </mesh>
      <mesh position={[0, H / 2, D / 2]} receiveShadow>
        <boxGeometry args={[W, H, 0.3]} />
        <meshStandardMaterial color={CREAM} roughness={0.9} />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]} receiveShadow>
        <boxGeometry args={[0.3, H, D]} />
        <meshStandardMaterial color={CREAM} roughness={0.9} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} receiveShadow>
        <boxGeometry args={[0.3, H, D]} />
        <meshStandardMaterial color={CREAM} roughness={0.9} />
      </mesh>

      {/* 紅色腰帶飾條（四面） */}
      <mesh position={[0, 1.6, -D / 2 + 0.17]}>
        <boxGeometry args={[W, 0.34, 0.06]} />
        <meshStandardMaterial color={RED} roughness={0.55} emissive={RED} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 1.6, D / 2 - 0.17]}>
        <boxGeometry args={[W, 0.34, 0.06]} />
        <meshStandardMaterial color={RED} roughness={0.55} emissive={RED} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[-W / 2 + 0.17, 1.6, 0]}>
        <boxGeometry args={[0.06, 0.34, D]} />
        <meshStandardMaterial color={RED} roughness={0.55} emissive={RED} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[W / 2 - 0.17, 1.6, 0]}>
        <boxGeometry args={[0.06, 0.34, D]} />
        <meshStandardMaterial color={RED} roughness={0.55} emissive={RED} emissiveIntensity={0.12} />
      </mesh>

      {/* 天花板 + 紅色圓頂環 */}
      <mesh rotation-x={Math.PI / 2} position={[0, H, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#3a3339" roughness={0.95} />
      </mesh>
      {/* 平貼天花板的紅色圓頂飾環（不使用立體 torus，避免闖入巡航鏡頭） */}
      <mesh rotation-x={Math.PI / 2} position={[0, H - 0.03, 0]}>
        <ringGeometry args={[3.5, 4.6, 48]} />
        <meshStandardMaterial color="#8e2129" roughness={0.7} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, H - 0.04, 0]}>
        <ringGeometry args={[3.36, 3.5, 48]} />
        <meshStandardMaterial color="#e8c17a" roughness={0.4} metalness={0.5} emissive="#a87c34" emissiveIntensity={0.5} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, H - 0.05, 0]}>
        <circleGeometry args={[3.36, 40]} />
        <meshStandardMaterial color="#4a2c33" roughness={0.8} emissive="#c04a48" emissiveIntensity={0.35} />
      </mesh>
    </group>
  )
}

function Pendants() {
  const bulbMat = useMemo(
    () => new MeshStandardMaterial({ color: '#ffe6c0', emissive: WARM_BULB, emissiveIntensity: 3.2 }),
    [],
  )
  const spots: [number, number][] = [
    [5.6, -3.4], [-5.6, -3.4], [5.6, 3.6], [-5.6, 3.6],
  ]
  return (
    <group>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, H - 0.7, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 1.3, 6]} />
            <meshStandardMaterial color="#463b34" roughness={0.7} />
          </mesh>
          <mesh position={[0, H - 1.42, 0]} material={bulbMat}>
            <sphereGeometry args={[0.15, 14, 12]} />
          </mesh>
        </group>
      ))}
      {/* 實際光源只放 3 顆（省效能） */}
      <pointLight position={[5.6, H - 1.6, -3.4]} intensity={26} distance={13} decay={1.9} color={WARM_BULB} />
      <pointLight position={[-5.6, H - 1.6, 3.6]} intensity={26} distance={13} decay={1.9} color={WARM_BULB} />
      <pointLight position={[0, H - 1.2, -0.5]} intensity={34} distance={15} decay={1.9} color="#ffd9a0" />
    </group>
  )
}

function FrontDesk() {
  const sign = centerSignTexture()
  const emblem = deskEmblemTexture()
  return (
    <group position={[0, 0, -7.35]}>
      {/* 白色櫃台主體 */}
      <RoundedBox args={[5.2, 1.02, 1.35]} radius={0.09} smoothness={3} position={[0, 0.51, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f6efe3" roughness={0.5} />
      </RoundedBox>
      {/* 紅色檯面 */}
      <RoundedBox args={[5.6, 0.12, 1.6]} radius={0.05} smoothness={2} position={[0, 1.08, 0]} castShadow>
        <meshStandardMaterial color={RED} roughness={0.35} metalness={0.15} emissive={RED} emissiveIntensity={0.1} />
      </RoundedBox>
      {/* 正面紅帶 + 寶貝球徽章 */}
      <mesh position={[0, 0.55, 0.69]}>
        <planeGeometry args={[5.1, 0.3]} />
        <meshStandardMaterial color={RED} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.55, 0.695]}>
        <planeGeometry args={[0.62, 0.62]} />
        <meshBasicMaterial map={emblem} transparent />
      </mesh>
      {/* 牆上招牌（高於卡牆） */}
      <mesh position={[0, 5.45, -1.68]}>
        <planeGeometry args={[5.0, 1.1]} />
        <meshBasicMaterial map={sign} transparent />
      </mesh>
    </group>
  )
}

function HealingMachine() {
  const slotMat = useMemo(
    () => new MeshStandardMaterial({ color: '#9adfef', emissive: '#35e0ff', emissiveIntensity: 1.4, roughness: 0.3 }),
    [],
  )
  useFrame(({ clock }) => {
    slotMat.emissiveIntensity = 1.5 + Math.sin(clock.elapsedTime * 2.4) * 0.9
  })
  const slots: [number, number][] = []
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) slots.push([-0.42 + c * 0.42, 0.22 - r * 0.44])
  return (
    <group position={[-4.9, 0, -7.75]} rotation-y={0.18}>
      <RoundedBox args={[1.9, 0.92, 1.25]} radius={0.1} smoothness={3} position={[0, 0.46, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f4f3f0" roughness={0.45} />
      </RoundedBox>
      {/* 傾斜面板 + 6 顆寶貝球槽 */}
      <group position={[0, 0.95, 0.1]} rotation-x={-0.42}>
        <RoundedBox args={[1.7, 0.06, 1.05]} radius={0.03} smoothness={2}>
          <meshStandardMaterial color="#e8e6e0" roughness={0.5} />
        </RoundedBox>
        {slots.map(([x, z], i) => (
          <mesh key={i} position={[x, 0.07, z]} material={slotMat}>
            <sphereGeometry args={[0.085, 12, 10]} />
          </mesh>
        ))}
      </group>
      {/* 玻璃圓頂 */}
      <mesh position={[0.52, 1.06, -0.32]}>
        <sphereGeometry args={[0.34, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#bfe8ff" transparent opacity={0.28} roughness={0.1} metalness={0.4} />
      </mesh>
      {/* 紅十字 */}
      <mesh position={[-0.55, 0.52, 0.635]}>
        <planeGeometry args={[0.3, 0.09]} />
        <meshStandardMaterial color="#e5484d" emissive="#e5484d" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-0.55, 0.52, 0.635]}>
        <planeGeometry args={[0.09, 0.3]} />
        <meshStandardMaterial color="#e5484d" emissive="#e5484d" emissiveIntensity={0.8} />
      </mesh>
      <pointLight position={[0, 1.45, 0.4]} intensity={5} distance={4} decay={2} color="#35e0ff" />
    </group>
  )
}

function PcCorner() {
  const screen = pcScreenTexture()
  return (
    <group position={[9.1, 0, -7.3]} rotation-y={-0.7}>
      <RoundedBox args={[1.7, 0.85, 0.85]} radius={0.06} smoothness={2} position={[0, 0.42, 0]} castShadow>
        <meshStandardMaterial color="#ded7c8" roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[1.0, 0.72, 0.1]} radius={0.04} smoothness={2} position={[0, 1.28, -0.1]} rotation-x={-0.12} castShadow>
        <meshStandardMaterial color="#3c3a42" roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 1.28, -0.043]} rotation-x={-0.12}>
        <planeGeometry args={[0.88, 0.6]} />
        <meshBasicMaterial map={screen} />
      </mesh>
      <RoundedBox args={[0.7, 0.05, 0.3]} radius={0.02} smoothness={2} position={[0, 0.88, 0.22]}>
        <meshStandardMaterial color="#55505a" roughness={0.6} />
      </RoundedBox>
      <pointLight position={[0, 1.4, 0.5]} intensity={4} distance={3.5} decay={2} color="#4ae2ff" />
    </group>
  )
}

function Windows() {
  const tex = nightWindowTexture()
  const shaft = lightShaftTexture()
  const zs = [-4.6, 0, 4.6]
  return (
    <group>
      {zs.map((z, i) => (
        <mesh key={`l${i}`} position={[-W / 2 + 0.17, 3.15, z]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[1.7, 3.0]} />
          <meshBasicMaterial map={tex} transparent />
        </mesh>
      ))}
      {zs.map((z, i) => (
        <mesh key={`r${i}`} position={[W / 2 - 0.17, 3.15, z]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[1.7, 3.0]} />
          <meshBasicMaterial map={tex} transparent />
        </mesh>
      ))}
      {/* 左側月光光柱（斜插入室內） */}
      {zs.map((z, i) => (
        <mesh key={`s${i}`} position={[-8.2, 2.7, z + 0.3]} rotation={[0, 0.25, -0.9]}>
          <planeGeometry args={[2.1, 6.2]} />
          <meshBasicMaterial
            map={shaft} color="#cfe0ff" transparent opacity={0.04}
            blending={AdditiveBlending} depthWrite={false} side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

function FrontDoor() {
  return (
    <group position={[0, 0, D / 2 - 0.18]}>
      <mesh position={[0, 1.55, 0]}>
        <planeGeometry args={[3.4, 3.1]} />
        <meshStandardMaterial color="#1c2b4d" roughness={0.15} metalness={0.6} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 1.55, -0.02]}>
        <boxGeometry args={[0.08, 3.1, 0.06]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 3.35, -0.05]}>
        <boxGeometry args={[3.8, 0.5, 0.14]} />
        <meshStandardMaterial color={RED} roughness={0.5} emissive={RED} emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

function Dust() {
  const ref = useRef<Points>(null)
  const positions = useMemo(() => {
    const n = 240
    const arr = new Float32Array(n * 3)
    let seed = 42
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let i = 0; i < n; i++) {
      arr[i * 3] = -10 + rand() * 16
      arr[i * 3 + 1] = 0.2 + rand() * 4.6
      arr[i * 3 + 2] = -7 + rand() * 13
    }
    return arr
  }, [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.rotation.y = Math.sin(t * 0.05) * 0.05
    ref.current.position.y = Math.sin(t * 0.18) * 0.12
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035} color="#ffe0b0" transparent opacity={0.4}
        sizeAttenuation blending={AdditiveBlending} depthWrite={false}
      />
    </points>
  )
}

export default function CenterHall() {
  return (
    <group>
      <Walls />
      <Pendants />
      <FrontDesk />
      <HealingMachine />
      <PcCorner />
      <Windows />
      <FrontDoor />
      <Dust />
    </group>
  )
}
