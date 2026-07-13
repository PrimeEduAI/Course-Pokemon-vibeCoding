'use client'
import { Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Group, MathUtils, Mesh, MeshStandardMaterial, SRGBColorSpace, Texture, TextureLoader } from 'three'
import { cardBackTexture, ghostSlotTexture } from './textures'
import type { CollectionCard } from './types'

const FONT_CJK = '/assets/fonts/DotGothic16-Regular.ttf'
const FONT_PIXEL = '/assets/fonts/PressStart2P-Regular.ttf'

/* 弧形展示牆：以 (0, y, -1.6) 為圓心、半徑 7.1 的內凹弧，兩排共 15 格 */
type Slot = { pos: [number, number, number]; rotY: number; phase: number }

function buildSlots(): Slot[] {
  const CX = 0, CZ = -1.55, R = 7.1
  const rows = [
    { y: 2.12, count: 8, spanDeg: 108 },
    { y: 3.44, count: 7, spanDeg: 92 },
  ]
  const slots: Slot[] = []
  rows.forEach((row, ri) => {
    for (let i = 0; i < row.count; i++) {
      const t = row.count === 1 ? 0.5 : i / (row.count - 1)
      const theta = MathUtils.degToRad(-row.spanDeg / 2 + row.spanDeg * t)
      slots.push({
        pos: [CX + R * Math.sin(theta), row.y, CZ - R * Math.cos(theta)],
        rotY: -theta,
        phase: ri * 2.1 + i * 0.83,
      })
    }
  })
  // 由中央往外排（放卡順序）
  return slots.sort((a, b) => Math.abs(a.rotY) - Math.abs(b.rotY) || a.pos[1] - b.pos[1])
}

/** 手動載入卡圖（useTexture 失敗會 throw，這裡要優雅回退到卡背） */
function useCardTexture(url: string) {
  const [tex, setTex] = useState<Texture | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let dead = false
    const loader = new TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      url,
      (t) => {
        if (dead) { t.dispose(); return }
        t.colorSpace = SRGBColorSpace
        t.anisotropy = 4
        setTex(t)
      },
      undefined,
      () => { if (!dead) setFailed(true) },
    )
    return () => { dead = true }
  }, [url])
  return { tex, failed }
}

function priceLabel(p: number | null) {
  return p == null ? '— —' : `US$ ${p.toFixed(2)}`
}

function CardFrame({ card, slot, onSelect }: { card: CollectionCard; slot: Slot; onSelect: (c: CollectionCard) => void }) {
  const inner = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const { tex, failed } = useCardTexture(card.imageSmall)
  const back = useMemo(() => (failed ? cardBackTexture() : null), [failed])
  const frameMat = useRef<MeshStandardMaterial>(null)

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => { document.body.style.cursor = 'auto' }
  }, [hovered])

  useFrame(({ clock }, dt) => {
    if (!inner.current) return
    const k = Math.min(1, dt * 7)
    const g = inner.current
    // 浮空微漂 + hover 抬升傾斜
    const bob = Math.sin(clock.elapsedTime * 0.9 + slot.phase) * 0.03
    g.position.y = MathUtils.lerp(g.position.y, bob + (hovered ? 0.09 : 0), k)
    g.position.z = MathUtils.lerp(g.position.z, hovered ? 0.28 : 0, k)
    g.rotation.x = MathUtils.lerp(g.rotation.x, hovered ? -0.1 : 0, k)
    const s = MathUtils.lerp(g.scale.x, hovered ? 1.07 : 1, k)
    g.scale.setScalar(s)
    if (frameMat.current) {
      frameMat.current.emissiveIntensity = MathUtils.lerp(frameMat.current.emissiveIntensity, hovered ? 1.1 : 0.18, k)
    }
  })

  return (
    <group position={slot.pos} rotation-y={slot.rotY}>
      <group
        ref={inner}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(card) }}
      >
        {/* 金屬邊框 */}
        <mesh castShadow>
          <boxGeometry args={[1.02, 1.38, 0.055]} />
          <meshStandardMaterial ref={frameMat} color="#4a3b26" metalness={0.75} roughness={0.32} emissive="#e0a44e" emissiveIntensity={0.18} />
        </mesh>
        {/* 卡面（或優雅卡背） */}
        <mesh position={[0, 0.045, 0.034]}>
          <planeGeometry args={[0.88, 1.2]} />
          {tex
            ? <meshStandardMaterial map={tex} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.32} roughness={0.5} />
            : <meshStandardMaterial map={back ?? undefined} color={back ? '#ffffff' : '#101528'} emissive={back ? '#ffffff' : '#0a0e1e'} emissiveMap={back ?? undefined} emissiveIntensity={back ? 0.3 : 0.4} roughness={0.55} />}
        </mesh>
        {/* 玻璃面 */}
        <mesh position={[0, 0.045, 0.06]}>
          <planeGeometry args={[0.96, 1.3]} />
          <meshStandardMaterial color="#cfe4ff" transparent opacity={0.07} roughness={0.08} metalness={0.6} />
        </mesh>
        {/* 名牌 */}
        <mesh position={[0, -0.585, 0.036]}>
          <planeGeometry args={[0.92, 0.185]} />
          <meshStandardMaterial color="#120f18" roughness={0.4} metalness={0.3} />
        </mesh>
        <Text
          font={FONT_CJK} fontSize={0.072} color="#f5eede" anchorX="center" anchorY="middle"
          position={[0, -0.548, 0.045]} maxWidth={0.88}
        >
          {card.name}
        </Text>
        <Text
          font={FONT_PIXEL} fontSize={0.046} color="#ffd166" anchorX="center" anchorY="middle"
          position={[0, -0.632, 0.045]}
        >
          {priceLabel(card.latestPrice)}
        </Text>
      </group>
    </group>
  )
}

function GhostFrame({ slot }: { slot: Slot }) {
  const ref = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const tex = ghostSlotTexture()
  useFrame(({ clock }, dt) => {
    if (!ref.current) return
    const m = ref.current.material as { opacity: number }
    const breathe = 0.62 + Math.sin(clock.elapsedTime * 1.1 + slot.phase) * 0.12
    m.opacity = MathUtils.lerp(m.opacity, hovered ? 0.92 : breathe, Math.min(1, dt * 5))
    ref.current.position.y = slot.pos[1] + Math.sin(clock.elapsedTime * 0.8 + slot.phase) * 0.035
  })
  return (
    <mesh
      ref={ref}
      position={slot.pos}
      rotation-y={slot.rotY}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[1.0, 1.36]} />
      <meshBasicMaterial map={tex} transparent opacity={0.5} depthWrite={false} />
    </mesh>
  )
}

export default function CardWall({ cards, onSelect }: { cards: CollectionCard[]; onSelect: (c: CollectionCard) => void }) {
  const slots = useMemo(buildSlots, [])
  const shown = cards.slice(0, slots.length)
  return (
    <group>
      {slots.map((slot, i) =>
        i < shown.length
          ? <CardFrame key={shown[i].id} card={shown[i]} slot={slot} onSelect={onSelect} />
          : <GhostFrame key={`ghost-${i}`} slot={slot} />,
      )}
    </group>
  )
}
