import { Vector3 } from 'three'
import { hasStab, type MoveDef } from '@/lib/battle/moves'
import { computeDamage } from '@/lib/battle/damage'
import { getTypeMult } from '@/lib/battle/typeChart'
import { bossDmgScale } from '@/lib/battle/bosses'
import { meterGain, type GimmickDef } from '@/lib/battle/gimmicks'
import { STATUS_META, atkMult as statusAtkMult, type StatusKind } from '@/lib/battle/status'
import { cryOnce, sfxImpact, sfxStatusApply, sfxSuperEffective } from '@/lib/sfx'
import { useBattle } from '@/stores/useBattle'
import { useNetwork } from '@/stores/useNetwork'
import { battleWorld } from '@/stores/battleWorld'

/** AI 傷害手感係數：沿用同一條傷害管線，僅整體縮放讓玩家能承受 4 拳左右 */
export const ENEMY_DAMAGE_SCALE = 0.45

/** PvP 傷害手感係數：雙方對稱套用（HP 池 ~200 → 一場 6–10 次有效命中） */
export const PVP_DAMAGE_SCALE = 0.75

/** 近戰垂直容差（雙向共用）：命中規則 = 水平距離 ≤ range 且 |Δy| ≤ 1.6m（+ 玩家側 ±60° 錐角） */
export const MELEE_Y_TOLERANCE = 1.6

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

/** 控制技命中：施加狀態 + 狀態名彈出字 + 專屬音效 */
function applyMoveStatus(move: MoveDef, target: 'player' | 'enemy', hitPos: Vector3) {
  if (!move.status) return
  const st = useBattle.getState()
  const now = performance.now()
  st.applyStatusTo(target, move.status, now)
  const meta = STATUS_META[move.status]
  st.addPopup({ text: `${meta.nameZh}！`, color: meta.color, pos: [hitPos.x, hitPos.y + 1.6, hitPos.z], big: true })
  sfxStatusApply()
}

/** 玩家招式命中 BOSS：傷害 + 白閃 + 擊退 + 傷害數字 */
export function hitEnemy(move: MoveDef, hitPos: Vector3) {
  const st = useBattle.getState()
  // PvP：傷害權威在守方 —— 只送命中嘗試（守方驗 i-frames 後以 hitC 回報），本地先給白閃回饋
  if (st.mode === 'pvp') {
    battleWorld.enemyFlashUntil = performance.now() + 110
    useNetwork.getState().sendGame({ g: 'hitA', moveId: move.id })
    return
  }
  const attacker = st.playerFighter
  const defender = st.enemyFighter
  const mult = getTypeMult(move.type, defender.types)
  const g = applyGimmick(move, attacker, defender, st.playerGimmick.active, st.enemyGimmick.active)
  // weaken（弱化）：攻方輸出 ×0.72
  const weak = statusAtkMult(st.playerEffects, performance.now())
  const dmg = Math.max(1, Math.round(computeDamage(g.move, g.atk, g.def, hasStab(move, attacker), mult) * weak))
  st.dealDamageToEnemy(dmg)
  applyMoveStatus(move, 'enemy', hitPos)
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
  // ENEMY_DAMAGE_SCALE 在招牌能力 atkMult 之後仍然套用（平衡護欄）；weaken 弱化 BOSS 輸出 ×0.72
  const weak = statusAtkMult(st.enemyEffects, performance.now())
  const dmg = Math.max(1, Math.round(raw * ENEMY_DAMAGE_SCALE * bossDmgScale(attacker.dexId) * weak))
  st.dealDamageToPlayer(dmg)
  applyMoveStatus(move, 'player', hitPos)
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

// ---------------------------------------------------------------------------
// PvP（好友對戰）：守方權威結算
// ---------------------------------------------------------------------------

/**
 * 對手宣告命中我（hitA）→ 守方（我）驗證並結算：
 * 疾走 i-frames 中直接閃掉（不回報 = 攻方看不到傷害數字，讀作「被閃掉」）；
 * 否則以對稱傷害公式扣自己的血，並以 hitC 回報攻方顯示數字/計量。
 */
export function pvpApplyHitToSelf(moveId: string) {
  const st = useBattle.getState()
  if (st.mode !== 'pvp' || st.phase !== 'fighting') return
  const now = performance.now()
  if (st.isInvulnerable(now)) return // 疾走無敵幀：完美迴避
  const attacker = st.enemyFighter
  const defender = st.playerFighter
  const move = attacker.moves.find((m) => m.id === moveId) ?? attacker.moves[0]
  const mult = getTypeMult(move.type, defender.types)
  const g = applyGimmick(move, attacker, defender, st.enemyGimmick.active, st.playerGimmick.active)
  const weak = statusAtkMult(st.enemyEffects, now)
  const dmg = Math.max(1, Math.round(computeDamage(g.move, g.atk, g.def, hasStab(move, attacker), mult) * PVP_DAMAGE_SCALE * weak))
  st.dealDamageToPlayer(dmg)
  const hitPos = battleWorld.playerPos
  applyMoveStatus(move, 'player', hitPos)
  st.gainMeter('player', meterGain('taken', dmg >= 60))
  if (mult >= 2) sfxSuperEffective()
  else sfxImpact(dmg >= 60)
  const after = useBattle.getState()
  if (after.playerHp > 0 && after.playerHp / after.playerMaxHp < 0.3) cryOnce(defender.dexId, 'player-low', 0.5)
  st.addPopup({ text: `${dmg}`, color: '#ff6b5e', pos: [hitPos.x, hitPos.y + 1.0, hitPos.z], big: dmg >= 60 })
  battleWorld.playerFlashUntil = now + 110
  knockDir.copy(battleWorld.playerPos).sub(battleWorld.enemyPos).setY(0).normalize()
  battleWorld.playerKnock.copy(knockDir).multiplyScalar(mult >= 2 ? 6 : 4)
  useNetwork.getState().sendGame({ g: 'hitC', dmg, mult, statusKind: move.status })
}

/** 守方結算回報（hitC）→ 攻方視角：傷害數字 / 特效 / 音效 / 計量（HP 以快照為權威，先扣求即時） */
export function pvpConfirmHitOnEnemy(msg: { dmg: number; mult: number; statusKind?: StatusKind }) {
  const st = useBattle.getState()
  if (st.mode !== 'pvp' || st.phase !== 'fighting') return
  const { dmg, mult } = msg
  st.dealDamageToEnemy(dmg)
  const e = battleWorld.enemyPos
  if (msg.statusKind) {
    st.applyStatusTo('enemy', msg.statusKind, performance.now())
    const meta = STATUS_META[msg.statusKind]
    st.addPopup({ text: `${meta.nameZh}！`, color: meta.color, pos: [e.x, e.y + 1.6, e.z], big: true })
  }
  st.gainMeter('player', meterGain('dealt', dmg >= 60))
  if (mult >= 2) sfxSuperEffective()
  else sfxImpact(dmg >= 60)
  st.addPopup({
    text: mult >= 2 ? `${dmg} ×2!` : mult === 0 ? '無效' : `${dmg}`,
    color: mult >= 2 ? '#ffe14d' : '#ffffff',
    pos: [e.x, e.y + 1.1, e.z],
    big: mult >= 2 || dmg >= 60,
  })
  battleWorld.enemyFlashUntil = performance.now() + 110
}
