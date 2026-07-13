import { Vector3 } from 'three'
import { hasStab, type MoveDef } from '@/lib/battle/moves'
import { computeDamage } from '@/lib/battle/damage'
import { getTypeMult } from '@/lib/battle/typeChart'
import { bossDmgScale } from '@/lib/battle/bosses'
import { meterGain, type GimmickDef } from '@/lib/battle/gimmicks'
import { cryOnce, sfxImpact, sfxSuperEffective } from '@/lib/sfx'
import { useBattle } from '@/stores/useBattle'
import { battleWorld } from '@/stores/battleWorld'

/** AI 傷害手感係數：沿用同一條傷害管線，僅整體縮放讓玩家能承受 4 拳左右 */
export const ENEMY_DAMAGE_SCALE = 0.45

const knockDir = new Vector3()

/** 招牌能力加成：攻方 atk × atkMult、招式威力 × movePowerMult、守方 def × defMult */
function applyGimmick(move: MoveDef, attacker: { level: number; atk: number }, defender: { def: number }, atkG: GimmickDef | null, defG: GimmickDef | null) {
  const powMult = atkG?.movePowerMult ?? 1
  return {
    move: powMult === 1 ? move : { ...move, power: Math.round(move.power * powMult) },
    atk: { ...attacker, atk: attacker.atk * (atkG?.atkMult ?? 1) },
    def: { ...defender, def: defender.def * (defG?.defMult ?? 1) },
  }
}

/** 玩家招式命中 BOSS：傷害 + 白閃 + 擊退 + 傷害數字 */
export function hitEnemy(move: MoveDef, hitPos: Vector3) {
  const st = useBattle.getState()
  const attacker = st.playerFighter
  const defender = st.enemyFighter
  const mult = getTypeMult(move.type, defender.types)
  const g = applyGimmick(move, attacker, defender, st.playerGimmick.active, st.enemyGimmick.active)
  const dmg = computeDamage(g.move, g.atk, g.def, hasStab(move, attacker), mult)
  st.dealDamageToEnemy(dmg)
  // 招牌能力計量：打中 +8（重擊 ×1.5）、被打 +5
  const heavy = dmg >= 60
  st.gainMeter('player', meterGain('dealt', heavy))
  st.gainMeter('enemy', meterGain('taken', heavy))
  // SFX：效果絕佳 = 重擊 + sting；否則依傷害挑輕重命中音
  if (mult >= 2) sfxSuperEffective()
  else sfxImpact(dmg >= 60)
  // 低血量哀鳴：跌破 30% 時一次性鳴叫
  const afterE = useBattle.getState()
  if (afterE.enemyHp > 0 && afterE.enemyHp / afterE.enemyMaxHp < 0.3) cryOnce(defender.dexId, 'enemy-low', 0.5)
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
  const g = applyGimmick(move, attacker, defender, st.enemyGimmick.active, st.playerGimmick.active)
  const raw = computeDamage(g.move, g.atk, g.def, hasStab(move, attacker), mult)
  // ENEMY_DAMAGE_SCALE 在招牌能力 atkMult 之後仍然套用（平衡護欄）
  const dmg = Math.max(1, Math.round(raw * ENEMY_DAMAGE_SCALE * bossDmgScale(attacker.dexId)))
  st.dealDamageToPlayer(dmg)
  const heavy = dmg >= 60
  st.gainMeter('enemy', meterGain('dealt', heavy))
  st.gainMeter('player', meterGain('taken', heavy))
  if (mult >= 2) sfxSuperEffective()
  else sfxImpact(dmg >= 60)
  const afterP = useBattle.getState()
  if (afterP.playerHp > 0 && afterP.playerHp / afterP.playerMaxHp < 0.3) cryOnce(defender.dexId, 'player-low', 0.5)
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
