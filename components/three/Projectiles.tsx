'use client'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Group, Quaternion, Vector3 } from 'three'
import { useBattle, type ProjectileState } from '@/stores/useBattle'
import { battleWorld } from '@/stores/battleWorld'
import { hitEnemy, hitPlayer } from './combat'
import { PROJECTILE_VISUALS, resolveVisual } from './moveVisuals'

const HIT_RADIUS = 1.2
const Z_FORWARD = new Vector3(0, 0, 1)

/**
 * 彈體 = 模擬層（移動 / 命中 / 射程）+ 視覺層（moveVisuals 註冊表依招式分派）。
 * 視覺元件渲染在定向群組內：+z 即飛行方向。
 */
function Projectile({ p }: { p: ProjectileState }) {
  const group = useRef<Group>(null)
  const move = p.move
  const visualId = useMemo(() => resolveVisual(move), [move])
  const Visual = PROJECTILE_VISUALS[visualId]
  // 每顆彈體一次性配置（非每幀）
  const sim = useMemo(() => ({
    pos: new Vector3(...p.origin),
    dir: new Vector3(...p.dir).normalize(),
    target: new Vector3(),
    traveled: 0,
    done: false,
  }), [p])
  const quat = useMemo(() => new Quaternion().setFromUnitVectors(Z_FORWARD, sim.dir), [sim])

  useFrame((_, dt) => {
    if (!group.current || sim.done) return
    const st = useBattle.getState()
    const now = performance.now()
    const step = (move.speed ?? 12) * Math.min(dt, 0.05)
    sim.pos.addScaledVector(sim.dir, step)
    sim.traveled += step
    group.current.position.copy(sim.pos)

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
          color: move.color,
          angle: 0,
          scale: 1.25,
          variant: visualId,
        })
        sim.done = true
        st.removeProjectile(p.id)
        return
      }
    }

    // 射程耗盡：熄滅（小型通用爆閃即可）
    if (sim.traveled >= (move.range ?? 25)) {
      st.addFx({ kind: 'burst', pos: [sim.pos.x, sim.pos.y, sim.pos.z], color: move.color, angle: 0, scale: 0.4 })
      sim.done = true
      st.removeProjectile(p.id)
    }
  })

  return (
    <group ref={group} position={p.origin}>
      <group quaternion={quat}>
        <Visual move={move} />
      </group>
    </group>
  )
}

export default function Projectiles() {
  const projectiles = useBattle((s) => s.projectiles)
  return (
    <>
      {projectiles.map((p) => <Projectile key={p.id} p={p} />)}
    </>
  )
}
