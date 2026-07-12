'use client'
import { useMemo } from 'react'
import { AdditiveBlending, CylinderGeometry, DoubleSide, Group, MathUtils } from 'three'
import { getBeamAlphaMap } from './beamTexture'

const CORNERS: [number, number][] = [
  [36, 27],
  [-36, 27],
  [-36, -27],
  [36, -27],
]
const HEAD_Y = 26

/** 一座泛光燈塔：燈桿 + 發光燈板 + 加法混合光錐 */
function Tower({ x, z }: { x: number; z: number }) {
  const coneGeo = useMemo(() => {
    // 光束只延伸到全程 62%，配合漸層 alpha 在半空淡出，避免與草皮硬相交
    const dist = Math.sqrt(x * x + z * z + HEAD_Y * HEAD_Y) * 0.62
    const g = new CylinderGeometry(4.2, 0.5, dist, 20, 1, true)
    g.rotateX(Math.PI / 2) // 寬端轉到 +Z
    g.translate(0, 0, dist / 2) // 光源端移到原點
    return g
  }, [x, z])

  return (
    <group position={[x, 0, z]}>
      {/* 燈桿 */}
      <mesh position={[0, HEAD_Y / 2 - 1, 0]}>
        <boxGeometry args={[1.1, HEAD_Y + 2, 1.1]} />
        <meshStandardMaterial color="#1b1f28" roughness={0.85} />
      </mesh>
      {/* 燈頭（朝向球場中心） */}
      <group
        position={[0, HEAD_Y, 0]}
        onUpdate={(g: Group) => g.lookAt(0, 0, 0)}
      >
        <mesh position={[0, 0, -0.35]}>
          <boxGeometry args={[4.4, 2.8, 0.6]} />
          <meshStandardMaterial color="#10131a" roughness={0.8} />
        </mesh>
        {/* 發光燈板 */}
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[4, 2.4]} />
          <meshBasicMaterial color={[2.6, 2.9, 3.2]} toneMapped={false} />
        </mesh>
        {/* 體積光錐 */}
        <mesh geometry={coneGeo}>
          <meshBasicMaterial
            color="#9db9ea"
            transparent
            opacity={0.22}
            alphaMap={getBeamAlphaMap()}
            blending={AdditiveBlending}
            depthWrite={false}
            side={DoubleSide}
            fog={false}
          />
        </mesh>
      </group>
    </group>
  )
}

export default function Floodlights() {
  return (
    <group>
      {CORNERS.map(([x, z], i) => (
        <Tower key={i} x={x} z={z} />
      ))}
      {/* 兩盞真實聚光燈補打場面（不投影，省效能） */}
      <spotLight
        position={[36, HEAD_Y, 27]}
        angle={MathUtils.degToRad(34)}
        penumbra={0.65}
        intensity={1.4}
        decay={0}
        color="#dfe9ff"
      />
      <spotLight
        position={[-36, HEAD_Y, -27]}
        angle={MathUtils.degToRad(34)}
        penumbra={0.65}
        intensity={1.4}
        decay={0}
        color="#dfe9ff"
      />
    </group>
  )
}
