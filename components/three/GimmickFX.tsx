'use client'
/**
 * 世代招牌能力特效層（掛在 BattleScene Canvas 內）：
 * - 羈絆爆發（gen1–5）：金色氣場 + 上升光粒
 * - MEGA 進化（gen6）：彩虹氣場（模型換裝時同步發光）
 * - Z 招式（gen7）：1.2s 蓄力（Z 環 + 畫面壓暗）→ 必中超彈 → 大爆點
 * - 極巨化（gen8）：紅黑能量渦雲 + 深紅氣柱 + 地面紅環
 * 另負責：持續時間到期的收尾（expireGimmick）。
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending, Color, DoubleSide, Group, Mesh, MeshBasicMaterial,
  PointLight, Sprite, Vector3,
} from 'three'
import { ZMOVE_CHARGE_MS, type GimmickDef } from '@/lib/battle/gimmicks'
import { useBattle, type GimmickSideId } from '@/stores/useBattle'
import { battleWorld } from '@/stores/battleWorld'
import { hitEnemy, hitPlayer } from './combat'
import { getGlowTexture } from './glowTexture'

/** 剛體中心 → 腳底的偏移（Player / EnemyFighter 內的模型群組偏移） */
const FOOT_OFFSET: Record<GimmickSideId, number> = { player: -1.05, enemy: -1.35 }

const tmpV = new Vector3()

function sidePos(side: GimmickSideId): Vector3 {
  return side === 'player' ? battleWorld.playerPos : battleWorld.enemyPos
}

/**
 * 到期驅動：durationMs 有限且時間到 → 收掉發動狀態。
 * Z 招式除外 —— 它的生命週期由 ZMoveFX 自己收（必中彈結算完才卸），
 * 避免掉幀 / 分頁切換讓視窗先過期、威力倍率沒吃到。
 */
function ExpiryDriver() {
  useFrame(() => {
    const st = useBattle.getState()
    const now = performance.now()
    for (const side of ['player', 'enemy'] as const) {
      const g = side === 'player' ? st.playerGimmick : st.enemyGimmick
      if (g.active && g.active.kind !== 'zmove' && Number.isFinite(g.endsAt) && now >= g.endsAt) st.expireGimmick(side)
    }
  })
  return null
}

// ---------------------------------------------------------------------------
// 氣場（羈絆爆發 = 金色、MEGA = 彩虹）：貼地光環 + 環繞上升光粒 + 點光
// ---------------------------------------------------------------------------

const N_SPARKS = 8

function AuraFX({ side, def }: { side: GimmickSideId; def: GimmickDef }) {
  const root = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const sparks = useRef<(Sprite | null)[]>([])
  const light = useRef<PointLight>(null)
  const glowMap = useMemo(() => getGlowTexture(), [])
  const rainbow = def.kind === 'mega'
  const baseColor = rainbow ? '#ff77e8' : '#ffd166'
  const hueColor = useMemo(() => new Color(), [])

  useFrame(({ clock }) => {
    const g = root.current
    if (!g) return
    const p = sidePos(side)
    g.position.set(p.x, p.y + FOOT_OFFSET[side] + 0.06, p.z)
    const t = clock.elapsedTime
    // 彩虹（MEGA）：色相循環；金色（羈絆）固定
    if (rainbow) hueColor.setHSL((t * 0.35) % 1, 1, 0.62)
    if (ring.current) {
      ring.current.rotation.z = t * 1.4
      const m = ring.current.material as MeshBasicMaterial
      m.opacity = 0.5 + Math.sin(t * 6) * 0.18
      if (rainbow) m.color.copy(hueColor)
    }
    for (let i = 0; i < N_SPARKS; i++) {
      const s = sparks.current[i]
      if (!s) continue
      const k = ((t * 0.55 + i / N_SPARKS) % 1)
      const a = i * 2.4 + t * 1.8
      const r = 0.75 + Math.sin(i * 1.7) * 0.25
      s.position.set(Math.cos(a) * r, k * 2.4, Math.sin(a) * r)
      const mat = s.material
      mat.opacity = Math.sin(k * Math.PI) * 0.85
      if (rainbow) mat.color.copy(hueColor).offsetHSL(i * 0.12, 0, 0)
    }
    if (light.current) {
      light.current.intensity = 5 + Math.sin(t * 9) * 2
      if (rainbow) light.current.color.copy(hueColor)
    }
  })

  return (
    <group ref={root}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1.25, 40]} />
        <meshBasicMaterial color={baseColor} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.55} side={DoubleSide} />
      </mesh>
      {Array.from({ length: N_SPARKS }, (_, i) => (
        <sprite key={i} ref={(el) => { sparks.current[i] = el }} scale={[0.34, 0.34, 1]}>
          <spriteMaterial map={glowMap} color={baseColor} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.8} />
        </sprite>
      ))}
      <pointLight ref={light} color={baseColor} intensity={5} distance={7} decay={2} position={[0, 1.2, 0]} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 極巨化：頭頂紅黑能量渦雲 + 氣柱 + 地面紅環 + 深紅點光
// ---------------------------------------------------------------------------

const N_CLOUDS = 7

function DynamaxFX({ side, def }: { side: GimmickSideId; def: GimmickDef }) {
  const root = useRef<Group>(null)
  const clouds = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const pillar = useRef<Mesh>(null)
  const light = useRef<PointLight>(null)
  const glowMap = useMemo(() => getGlowTexture(), [])
  const fighter = useBattle((s) => (side === 'player' ? s.playerFighter : s.enemyFighter))
  const cloudY = fighter.targetHeight * def.scale + 0.9

  useFrame(({ clock }) => {
    const g = root.current
    if (!g) return
    const p = sidePos(side)
    g.position.set(p.x, p.y + FOOT_OFFSET[side], p.z)
    const t = clock.elapsedTime
    if (clouds.current) {
      clouds.current.rotation.y = t * 0.9
      clouds.current.position.y = cloudY + Math.sin(t * 1.6) * 0.18
    }
    if (ring.current) {
      ring.current.rotation.z = -t * 1.1
      ;(ring.current.material as MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 5) * 0.2
    }
    if (pillar.current) {
      const m = pillar.current.material as MeshBasicMaterial
      m.opacity = 0.1 + Math.abs(Math.sin(t * 2.4)) * 0.1
      pillar.current.rotation.y = t * 0.6
    }
    if (light.current) light.current.intensity = 9 + Math.sin(t * 7) * 3.5
  })

  return (
    <group ref={root}>
      {/* 渦雲：暗紅雲團（normal blending 保持黑）+ 內側紅光暈 */}
      <group ref={clouds} position={[0, cloudY, 0]}>
        {Array.from({ length: N_CLOUDS }, (_, i) => {
          const a = (i / N_CLOUDS) * Math.PI * 2
          const r = 1.5 + (i % 3) * 0.45
          return (
            <group key={i} position={[Math.cos(a) * r, (i % 2) * 0.45 - 0.2, Math.sin(a) * r]}>
              <sprite scale={[2.4, 1.6, 1]}>
                <spriteMaterial map={glowMap} color="#12030a" depthWrite={false} transparent opacity={0.88} />
              </sprite>
              <sprite scale={[1.25, 0.9, 1]}>
                <spriteMaterial map={glowMap} color="#ff2545" blending={AdditiveBlending} depthWrite={false} transparent opacity={0.5} />
              </sprite>
            </group>
          )
        })}
        <sprite scale={[3.4, 2.2, 1]}>
          <spriteMaterial map={glowMap} color="#ff1e3c" blending={AdditiveBlending} depthWrite={false} transparent opacity={0.32} />
        </sprite>
      </group>
      {/* 能量氣柱：從腳底往上包住整隻 */}
      <mesh ref={pillar} position={[0, cloudY * 0.5, 0]}>
        <cylinderGeometry args={[1.15, 1.5, cloudY, 20, 1, true]} />
        <meshBasicMaterial color="#ff2545" toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.14} side={DoubleSide} />
      </mesh>
      {/* 地面紅環 */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.35, 1.95, 44]} />
        <meshBasicMaterial color="#ff2d5e" toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.6} side={DoubleSide} />
      </mesh>
      {/* 深紅 rim 光：拉高一點打在放大後的身體上 */}
      <pointLight ref={light} color="#ff2038" intensity={9} distance={12} decay={1.8} position={[0, cloudY * 0.6, 0]} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Z 招式：蓄力（Z 環 + 壓暗）→ 必中超彈（aura 樣式 2.5×）→ 抵達直接結算
// ---------------------------------------------------------------------------

const ZMOVE_FLIGHT_MS = 480

function ZMoveFX({ side, activatedAt }: { side: GimmickSideId; activatedAt: number }) {
  const rings = useRef<(Mesh | null)[]>([])
  const dim = useRef<Mesh>(null)
  const orb = useRef<Group>(null)
  const beam = useRef<Mesh>(null)
  const camera = useThree((s) => s.camera)
  const glowMap = useMemo(() => getGlowTexture(), [])
  const done = useRef(false)
  const origin = useRef<Vector3 | null>(null)
  const st0 = useBattle.getState()
  const attacker = side === 'player' ? st0.playerFighter : st0.enemyFighter
  /** 超彈招式：拿投射招當基底（威力倍率由 combat 依 movePowerMult 統一套用） */
  const superMove = useMemo(() => {
    const projMove = attacker.moves[1]
    return { ...projMove, nameZh: `Z·${projMove.nameZh}`, visual: 'aura' as const }
  }, [attacker])
  const color = superMove.color

  useFrame(() => {
    const now = performance.now()
    const elapsed = now - activatedAt
    const p = sidePos(side)
    const targetPos = sidePos(side === 'player' ? 'enemy' : 'player')

    // 蓄力 Z 環：三環由腳底向外擴張、循環兩輪
    for (let i = 0; i < 3; i++) {
      const m = rings.current[i]
      if (!m) continue
      const k = Math.max(0, Math.min(1, ((elapsed / ZMOVE_CHARGE_MS) * 2 - i * 0.28) % 1))
      const visible = elapsed < ZMOVE_CHARGE_MS
      m.visible = visible
      if (visible) {
        m.position.set(p.x, p.y + FOOT_OFFSET[side] + 0.1 + k * 2.2, p.z)
        m.scale.setScalar(0.5 + k * 2.2)
        ;(m.material as MeshBasicMaterial).opacity = (1 - k) * 0.85
      }
    }
    // 蓄力光柱
    if (beam.current) {
      beam.current.visible = elapsed < ZMOVE_CHARGE_MS
      beam.current.position.set(p.x, p.y + FOOT_OFFSET[side] + 3, p.z)
      ;(beam.current.material as MeshBasicMaterial).opacity = 0.2 + Math.abs(Math.sin(elapsed * 0.02)) * 0.2
    }
    // 畫面壓暗（DOM-free：鏡頭前的大黑片）
    if (dim.current) {
      const k = elapsed < ZMOVE_CHARGE_MS
        ? Math.min(1, elapsed / 200)
        : Math.max(0, 1 - (elapsed - ZMOVE_CHARGE_MS) / 500)
      tmpV.set(0, 0, -1).applyQuaternion(camera.quaternion)
      dim.current.position.copy(camera.position).addScaledVector(tmpV, 1.2)
      dim.current.quaternion.copy(camera.quaternion)
      ;(dim.current.material as MeshBasicMaterial).opacity = k * 0.5
      dim.current.visible = k > 0.01
    }
    // 超彈：蓄力結束 → 從發動者胸口飛向目標（追蹤目標 = 必中）
    if (orb.current) {
      if (elapsed < ZMOVE_CHARGE_MS || done.current) {
        orb.current.visible = false
      } else {
        if (!origin.current) origin.current = new Vector3(p.x, p.y + 0.5, p.z)
        const k = Math.min(1, (elapsed - ZMOVE_CHARGE_MS) / ZMOVE_FLIGHT_MS)
        orb.current.visible = true
        orb.current.position.copy(origin.current).lerp(tmpV.copy(targetPos), k)
        orb.current.scale.setScalar(1 + Math.sin(elapsed * 0.03) * 0.12)
        if (k >= 1 && !done.current) {
          done.current = true
          orb.current.visible = false
          const st = useBattle.getState()
          // 必中結算：此刻 zmove 仍在發動中（過期由下方自己收），威力 ×2.6 由 combat 套用
          if (side === 'player') hitEnemy(superMove, tmpV.copy(targetPos))
          else hitPlayer(superMove, tmpV.copy(targetPos))
          st.addFx({ kind: 'burst', pos: [targetPos.x, targetPos.y + 0.3, targetPos.z], color, angle: 0, scale: 2.5, variant: 'aura' })
          useBattle.getState().expireGimmick(side) // 演出結束：收掉發動狀態
        }
      }
    }
  })

  return (
    <group>
      {Array.from({ length: 3 }, (_, i) => (
        <mesh key={i} ref={(el) => { rings.current[i] = el }} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1, 0.06, 8, 40]} />
          <meshBasicMaterial color={i === 1 ? '#ffe14d' : color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.85} side={DoubleSide} />
        </mesh>
      ))}
      <mesh ref={beam}>
        <cylinderGeometry args={[0.5, 0.8, 6, 16, 1, true]} />
        <meshBasicMaterial color={color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.3} side={DoubleSide} />
      </mesh>
      {/* 壓暗片：貼著鏡頭、蓋過場景但在 UI 之下 */}
      <mesh ref={dim} renderOrder={950} visible={false}>
        <planeGeometry args={[6, 4]} />
        <meshBasicMaterial color="#01020a" transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>
      {/* 超彈：亮核 + 波動殼 + 大光暈（aura 家族放大 2.5×） */}
      <group ref={orb} visible={false}>
        <mesh>
          <sphereGeometry args={[0.4, 18, 18]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={1} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.8, 20, 20]} />
          <meshBasicMaterial color={color} toneMapped={false} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.35} wireframe />
        </mesh>
        <sprite scale={[3.5, 3.5, 1]}>
          <spriteMaterial map={glowMap} color={color} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.85} />
        </sprite>
        <pointLight color={color} intensity={16} distance={12} decay={2} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 分派
// ---------------------------------------------------------------------------

function SideFX({ side }: { side: GimmickSideId }) {
  const g = useBattle((s) => (side === 'player' ? s.playerGimmick : s.enemyGimmick))
  if (!g.active) return null
  switch (g.active.kind) {
    case 'zmove':
      return <ZMoveFX side={side} activatedAt={g.activatedAt} />
    case 'dynamax':
      return <DynamaxFX side={side} def={g.active} />
    default: // bond / mega（模型換裝與否都上氣場）
      return <AuraFX side={side} def={g.active} />
  }
}

export default function GimmickFX() {
  return (
    <>
      <ExpiryDriver />
      <SideFX side="player" />
      <SideFX side="enemy" />
    </>
  )
}
