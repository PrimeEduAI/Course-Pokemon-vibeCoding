'use client'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group } from 'three'
import { useBattle, type DamagePopup } from '@/stores/useBattle'

const LIFE_MS = 900

function Popup({ pop }: { pop: DamagePopup }) {
  const group = useRef<Group>(null)
  const div = useRef<HTMLDivElement>(null)
  useFrame(() => {
    if (!group.current) return
    const k = (performance.now() - pop.at) / LIFE_MS
    if (k >= 1) {
      useBattle.getState().removePopup(pop.id)
      return
    }
    group.current.position.y = pop.pos[1] + k * 1.35
    if (div.current) {
      div.current.style.opacity = String(k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.45) / 0.55))
      div.current.style.transform = `scale(${pop.big ? 1.15 + Math.max(0, 0.5 - k) : 1})`
    }
  })
  return (
    <group ref={group} position={pop.pos}>
      <Html center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={div}
          style={{
            fontFamily: "'PressStart2P', monospace",
            fontSize: pop.big ? 22 : 15,
            color: pop.color,
            textShadow: `0 0 8px ${pop.color}, 0 2px 0 rgba(0,0,0,0.85)`,
            whiteSpace: 'nowrap',
            opacity: 0,
          }}
        >
          {pop.text}
        </div>
      </Html>
    </group>
  )
}

export default function DamagePopups() {
  const popups = useBattle((s) => s.popups)
  return (
    <>
      {popups.map((p) => <Popup key={p.id} pop={p} />)}
    </>
  )
}
