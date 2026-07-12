'use client'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, CylinderGeometry, Group } from 'three'
import { getBeamAlphaMap } from './beamTexture'

const COUNT = 6
const A = 38.2
const B = 30.6
const Y = 13.2

/** 看台頂沿的雷射燈秀：加法混合光柱，掃過球場上空 */
export default function LaserShow() {
  const refs = useRef<(Group | null)[]>([])

  const beams = useMemo(() => {
    // 底窄頂寬的光柱，底端在原點，沿 +Y 展開；打向場內地面
    const geo = new CylinderGeometry(1.7, 0.28, 26, 12, 1, true)
    geo.translate(0, 13, 0)
    return Array.from({ length: COUNT }, (_, i) => {
      const ang = (i / COUNT) * Math.PI * 2 + Math.PI / 7
      return {
        geo,
        pos: [Math.cos(ang) * A, Y, Math.sin(ang) * B] as [number, number, number],
        // 讓局部 +Z 指向場中央：先繞 Y 轉 baseYaw，再繞 X 傾斜
        baseYaw: -Math.PI / 2 - ang,
        color: (i % 2 === 0 ? [2.4, 0.5, 1.3] : [0.5, 2.0, 2.5]) as [number, number, number],
        phase: i * 1.13,
        speed: 0.35 + (i % 3) * 0.08,
      }
    })
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((g, i) => {
      if (!g) return
      const b = beams[i]
      g.rotation.order = 'YXZ'
      g.rotation.y = b.baseYaw + Math.sin(t * b.speed + b.phase) * 0.9
      // > π/2：光束向下打進場內，掃過草皮
      g.rotation.x = 2.15 + Math.sin(t * b.speed * 0.63 + b.phase * 2.1) * 0.2
    })
  })

  return (
    <group>
      {beams.map((b, i) => (
        <group key={i} position={b.pos} ref={(el) => { refs.current[i] = el }}>
          <mesh geometry={b.geo}>
            <meshBasicMaterial
              color={b.color}
              transparent
              opacity={0.55}
              alphaMap={getBeamAlphaMap()}
              blending={AdditiveBlending}
              depthWrite={false}
              fog={false}
              toneMapped={false}
            />
          </mesh>
          {/* 光源亮點 */}
          <mesh>
            <sphereGeometry args={[0.65, 8, 8]} />
            <meshBasicMaterial color={b.color} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
