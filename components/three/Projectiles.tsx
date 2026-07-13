'use client'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, Group, Vector3 } from 'three'
import { MOVES, type MoveDef } from '@/lib/battle/moves'
import { useBattle, type ProjectileState } from '@/stores/useBattle'
import { battleWorld } from '@/stores/battleWorld'
import { hitEnemy, hitPlayer } from './combat'
import { getGlowTexture } from './glowTexture'

const HIT_RADIUS = 1.2

const STYLE = {
  thunderbolt: { color: '#ffe95c', core: '#fffbe0', size: 0.24, light: 9 },
  flamethrower: { color: '#ff8a3d', core: '#ffd9a8', size: 0.3, light: 8 },
  quickAttack: { color: '#ffffff', core: '#ffffff', size: 0.2, light: 4 },
  firePunch: { color: '#ff8a3d', core: '#ffd9a8', size: 0.2, light: 4 },
} as const

function Orb({ p }: { p: ProjectileState }) {
  const group = useRef<Group>(null)
  const move: MoveDef = MOVES[p.moveId]
  const style = STYLE[p.moveId]
  // 每顆彈體一次性配置（非每幀）
  const sim = useMemo(() => ({
    pos: new Vector3(...p.origin),
    dir: new Vector3(...p.dir).normalize(),
    target: new Vector3(),
    traveled: 0,
    done: false,
  }), [p])
  const glowMap = useMemo(() => getGlowTexture(), [])

  useFrame((state, dt) => {
    if (!group.current || sim.done) return
    const st = useBattle.getState()
    const now = performance.now()
    const step = (move.speed ?? 12) * Math.min(dt, 0.05)
    sim.pos.addScaledVector(sim.dir, step)
    sim.traveled += step
    group.current.position.copy(sim.pos)
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 24) * 0.18
    group.current.scale.setScalar(pulse)

    if (st.phase !== 'fighting') {
      sim.done = true
      st.removeProjectile(p.id)
      return
    }

    // 命中判定：與目標剛體中心距離
    sim.target.copy(p.owner === 'player' ? battleWorld.enemyPos : battleWorld.playerPos)
    if (sim.target.distanceTo(sim.pos) <= HIT_RADIUS) {
      // 玩家衝刺 i-frames：敵方彈體直接穿過
      if (!(p.owner === 'enemy' && st.isInvulnerable(now))) {
        if (p.owner === 'player') hitEnemy(move, sim.target)
        else hitPlayer(move, sim.target)
        st.addFx({
          kind: 'burst',
          pos: [sim.pos.x, sim.pos.y, sim.pos.z],
          color: style.color,
          angle: 0,
          scale: 1.25,
        })
        sim.done = true
        st.removeProjectile(p.id)
        return
      }
    }

    // 射程耗盡：熄滅
    if (sim.traveled >= (move.range ?? 25)) {
      st.addFx({ kind: 'burst', pos: [sim.pos.x, sim.pos.y, sim.pos.z], color: style.color, angle: 0, scale: 0.4 })
      sim.done = true
      st.removeProjectile(p.id)
    }
  })

  return (
    <group ref={group} position={p.origin}>
      <mesh>
        <sphereGeometry args={[style.size, 16, 16]} />
        <meshStandardMaterial color={style.core} emissive={style.color} emissiveIntensity={4} toneMapped={false} />
      </mesh>
      <sprite scale={[style.size * 7, style.size * 7, 1]}>
        <spriteMaterial map={glowMap} color={style.color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.85} />
      </sprite>
      <pointLight color={style.color} intensity={style.light} distance={7} decay={2} />
    </group>
  )
}

export default function Projectiles() {
  const projectiles = useBattle((s) => s.projectiles)
  return (
    <>
      {projectiles.map((p) => <Orb key={p.id} p={p} />)}
    </>
  )
}
