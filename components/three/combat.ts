import { Vector3 } from 'three'
import { hasStab, type MoveDef } from '@/lib/battle/moves'
import { computeDamage } from '@/lib/battle/damage'
import { getTypeMult } from '@/lib/battle/typeChart'
import { bossDmgScale } from '@/lib/battle/bosses'
import { useBattle } from '@/stores/useBattle'
import { battleWorld } from '@/stores/battleWorld'

/** AI 傷害手感係數：沿用同一條傷害管線，僅整體縮放讓玩家能承受 4 拳左右 */
export const ENEMY_DAMAGE_SCALE = 0.45

const knockDir = new Vector3()

/** 玩家招式命中 BOSS：傷害 + 白閃 + 擊退 + 傷害數字 */
export function hitEnemy(move: MoveDef, hitPos: Vector3) {
  const st = useBattle.getState()
  const attacker = st.playerFighter
  const defender = st.enemyFighter
  const mult = getTypeMult(move.type, defender.types)
  const dmg = computeDamage(move, attacker, defender, hasStab(move, attacker), mult)
  st.dealDamageToEnemy(dmg)
  st.addPopup({
    text: mult >= 2 ? `${dmg} ×2!` : mult === 0 ? '無效' : `${dmg}`,
    color: mult >= 2 ? '#ffe14d' : '#ffffff',
    pos: [hitPos.x, hitPos.y + 1.1, hitPos.z],
    big: mult >= 2 || dmg >= 60,
  })
  battleWorld.enemyFlashUntil = performance.now() + 110
  knockDir.copy(battleWorld.enemyPos).sub(battleWorld.playerPos).setY(0).normalize()
  battleWorld.enemyKnock.copy(knockDir).multiplyScalar(mult >= 2 ? 6 : 4)
}

/** BOSS 招式命中玩家 */
export function hitPlayer(move: MoveDef, hitPos: Vector3) {
  const st = useBattle.getState()
  const attacker = st.enemyFighter
  const defender = st.playerFighter
  const mult = getTypeMult(move.type, defender.types)
  const raw = computeDamage(move, attacker, defender, hasStab(move, attacker), mult)
  const dmg = Math.max(1, Math.round(raw * ENEMY_DAMAGE_SCALE * bossDmgScale(attacker.dexId)))
  st.dealDamageToPlayer(dmg)
  st.addPopup({
    text: `${dmg}`,
    color: '#ff6b5e',
    pos: [hitPos.x, hitPos.y + 1.0, hitPos.z],
    big: dmg >= 60,
  })
  battleWorld.playerFlashUntil = performance.now() + 110
  knockDir.copy(battleWorld.playerPos).sub(battleWorld.enemyPos).setY(0).normalize()
  battleWorld.playerKnock.copy(knockDir).multiplyScalar(5)
}
