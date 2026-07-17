'use client'
import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector3 } from 'three'
import { mirrorVec3, mirrorYaw, type GameMsg } from '@/lib/pvp/protocol'
import { resolveGimmick } from '@/lib/battle/gimmicks'
import { playCryFile, playLaunch, sfxGimmickCharge, sfxSlash } from '@/lib/sfx'
import { useBattle } from '@/stores/useBattle'
import { useArena } from '@/stores/useArena'
import { useNetwork, netWorld, setGameHandler } from '@/stores/useNetwork'
import { battleWorld } from '@/stores/battleWorld'
import { pvpApplyHitToSelf, pvpConfirmHitOnEnemy } from './combat'
import { slashVariantForType } from './moveVisuals'
import { ARENAS } from './arenas/types'

/**
 * PvP 網路駕駛（掛在 BattleScene Canvas 內）：
 * - 送：20Hz 狀態快照（座標鏡像後出手）＋ 事件（近戰揮擊 / 投射出膛 / 招牌能力發動）。
 *   事件靠觀察 store / motion 頻道的變化打包 —— Player.tsx 完全不用改。
 * - 收：對手的戰鬥事件 → 重播動畫 / 特效 / 音效；hitA 走守方權威結算（combat.ts）。
 */

const SNAP_INTERVAL_MS = 50
const slashDir = new Vector3()

export default function PvpDriver() {
  const arenaId = useArena((s) => s.arenaId)
  const arenaGen = ARENAS.find((a) => a.id === arenaId)?.gen ?? 1

  useEffect(() => {
    setGameHandler((m: GameMsg) => {
      const st = useBattle.getState()
      const now = performance.now()
      switch (m.g) {
        case 'swing': {
          // 對手近戰：攻擊動畫 + 朝我方的弧形斬擊（位置由已插值的 enemyPos 推得）
          battleWorld.enemyMotion.attackAt = now
          const move = st.enemyFighter.moves[0]
          slashDir.copy(battleWorld.playerPos).sub(battleWorld.enemyPos).setY(0).normalize()
          const e = battleWorld.enemyPos
          st.addFx({
            kind: 'slash',
            pos: [e.x + slashDir.x, e.y + 0.35, e.z + slashDir.z],
            color: move.color,
            angle: Math.atan2(slashDir.x, slashDir.z),
            scale: 1,
            variant: slashVariantForType(move.type),
          })
          sfxSlash()
          break
        }
        case 'shot': {
          // 對手投射：生成視覺彈體（傷害另由 hitA 送達，Projectiles 在 pvp 模式不結算敵方彈體）
          battleWorld.enemyMotion.rangeAttackAt = now
          const move = st.enemyFighter.moves.find((mv) => mv.id === m.moveId) ?? st.enemyFighter.moves[1]
          st.spawnProjectile({ move, owner: 'enemy', origin: mirrorVec3(m.origin), dir: mirrorVec3(m.dir), scale: m.scale })
          playLaunch(move.visual)
          break
        }
        case 'hitA':
          pvpApplyHitToSelf(m.moveId)
          break
        case 'hitC':
          pvpConfirmHitOnEnemy(m)
          break
        case 'gimmick': {
          const def = resolveGimmick(arenaGen, st.enemyFighter.dexId)
          if (st.tryActivateGimmick('enemy', def, now)) {
            sfxGimmickCharge()
            playCryFile(st.enemyFighter.dexId, 0.7)
            if (def.kind === 'zmove') battleWorld.enemyMotion.attackAt = now
          }
          break
        }
        default:
          break
      }
    })
    return () => setGameHandler(null)
  }, [arenaGen])

  useFrame(() => {
    const net = useNetwork.getState()
    if (net.phase !== 'paired') return
    const st = useBattle.getState()
    const now = performance.now()
    const motion = battleWorld.playerMotion

    // 近戰揮擊（Z 招式的蓄力 pose 例外 —— 對方由 gimmick 事件自己補動畫）
    if (motion.attackAt > netWorld.lastAttackAtSent) {
      netWorld.lastAttackAtSent = motion.attackAt
      if (motion.attackAt !== st.playerGimmick.activatedAt) net.sendGame({ g: 'swing' })
    }
    // 投射出膛：以彈體 id 游標去重
    for (const p of st.projectiles) {
      if (p.owner === 'player' && p.id > netWorld.lastProjIdSent) {
        netWorld.lastProjIdSent = p.id
        net.sendGame({ g: 'shot', moveId: p.move.id, origin: mirrorVec3(p.origin), dir: mirrorVec3(p.dir), scale: p.scale })
      }
    }
    // 招牌能力發動
    if (st.playerGimmick.activatedAt > netWorld.lastGimmickAtSent) {
      netWorld.lastGimmickAtSent = st.playerGimmick.activatedAt
      net.sendGame({ g: 'gimmick' })
    }

    // 20Hz 狀態快照（座標/朝向鏡像；hp/計量是己方權威值）
    if (now - netWorld.lastSnapSentAt >= SNAP_INTERVAL_MS) {
      netWorld.lastSnapSentAt = now
      const p = battleWorld.playerPos
      net.sendGame({
        g: 'snap',
        p: mirrorVec3([p.x, p.y, p.z]),
        f: mirrorYaw(battleWorld.playerFacing),
        m: st.phase === 'defeat' ? 'ko' : motion.state,
        hp: st.playerHp,
        meter: st.playerGimmick.meter,
        used: st.playerGimmick.used,
      })
    }
  })

  return null
}
