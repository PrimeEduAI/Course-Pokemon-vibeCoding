'use client'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AnimationClip, Box3, Color, Group, LoopOnce, LoopRepeat, Mesh, MeshStandardMaterial,
  Object3D, SkinnedMesh, Vector3, type AnimationAction,
} from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { idleBob } from '@/lib/movement'
import { resolveClipRoles, type ClipRoles } from '@/lib/clipRoles'
import { battleWorld, type MotionChannel } from '@/stores/battleWorld'

interface Props {
  dexId: number
  targetHeight?: number
  /** 指定戰鬥實體 → 材質獨立複製，受擊時白閃 */
  entity?: 'player' | 'enemy'
  /** 關閉待機浮動（由外層控制動畫時使用） */
  bob?: boolean
  /** 骨骼動畫指令頻道（battleWorld.playerMotion / enemyMotion）；無片段的模型走程序式動作 */
  motion?: MotionChannel
}

interface FlashMat {
  mat: MeshStandardMaterial
  emissive: Color
  intensity: number
}

/**
 * 實際顯示尺寸的包圍盒：SkinnedMesh 需以骨骼綁定姿勢計算，
 * 靜態節點包圍盒（Box3.setFromObject）對部分寶可夢 GLB 會嚴重高估 → 模型被縮太小。
 */
function computeDisplayBox(root: Object3D): Box3 {
  root.updateMatrixWorld(true)
  const box = new Box3()
  const tmp = new Box3()
  root.traverse((o) => {
    if (o instanceof SkinnedMesh) {
      o.computeBoundingBox()
      if (o.boundingBox) box.union(tmp.copy(o.boundingBox).applyMatrix4(o.matrixWorld))
    } else if (o instanceof Mesh) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
      if (o.geometry.boundingBox) box.union(tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld))
    }
  })
  return box
}

/**
 * 去除 root motion：HOME 的 walk/run（部分 attack 也有）把整體位移烘在 `origin_*` 骨骼的
 * translation track 上（實測 run 位移可達 24 個模型單位）。世界位置由 RigidBody 驅動，
 * 因此把 origin 系 track 的 XZ 全部釘在第一幀（保留 Y 起伏）。
 */
function stripOriginXZ(clip: AnimationClip) {
  for (const track of clip.tracks) {
    if (!/^origin[^.]*\.position$/i.test(track.name)) continue
    const v = track.values
    for (let i = 3; i < v.length; i += 3) {
      v[i] = v[0]
      v[i + 2] = v[2]
    }
  }
}

/** 一次性動作角色 */
type OneShotRole = 'attack' | 'rangeattack' | 'damage'
const ONE_FADE = 0.15
const LOOP_FADE = 0.22

export default function PokemonModel({ dexId, targetHeight = 1.2, entity, bob = true, motion }: Props) {
  const { scene, animations } = useGLTF(`/assets/glb/regular/${dexId}.glb`)
  const { model, flashMats } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    const mats: FlashMat[] = []
    clone.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true
        if (entity) {
          // 戰鬥實體：複製材質避免共享快取被白閃污染
          o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone()
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (m instanceof MeshStandardMaterial) {
              mats.push({ mat: m, emissive: m.emissive.clone(), intensity: m.emissiveIntensity })
            }
          }
        }
      }
    })
    const size = computeDisplayBox(clone).getSize(new Vector3())
    clone.scale.setScalar(size.y > 0 ? targetHeight / size.y : 1)
    // 縮放後重算：腳貼地（y=0）、XZ 置中於旋轉軸
    const box = computeDisplayBox(clone)
    const center = box.getCenter(new Vector3())
    clone.position.set(clone.position.x - center.x, clone.position.y - box.min.y, clone.position.z - center.z)
    return { model: clone, flashMats: mats }
  }, [scene, targetHeight, entity])

  // 片段 → 角色：只取用到的片段、複製後改名為角色名（mixer 綁在含 clone 的 group 上，
  // 兩隻同圖鑑實體各自 clone + 各自 mixer，不共用動畫狀態）
  const { clips, roles } = useMemo(() => {
    const roles: ClipRoles = resolveClipRoles(animations.map((a) => ({ name: a.name, duration: a.duration })))
    const clips: AnimationClip[] = []
    for (const [role, clipName] of Object.entries(roles) as [keyof ClipRoles, string | null][]) {
      if (!clipName) continue
      const src = animations.find((a) => a.name === clipName)
      if (!src) continue
      const c = src.clone()
      c.name = role
      stripOriginXZ(c)
      clips.push(c)
    }
    return { clips, roles }
  }, [animations])

  const group = useRef<Group>(null)
  const { actions, mixer } = useAnimations(clips, group)

  // 回報外層：這隻模型自己會演倒地（Player / EnemyFighter 據此跳過程序式翻倒）
  useEffect(() => {
    if (!motion) return
    motion.hasKoClip = !!(roles.downStart || roles.downLoop)
    return () => { motion.hasKoClip = false }
  }, [motion, roles])

  // —— 動作狀態機（非反應式，全部走 ref）——
  const cur = useRef<string | null>(null) // 進行中的循環底層（'idle' | 'move'）
  const oneShot = useRef<OneShotRole | null>(null)
  const koActive = useRef(false)
  // 掛載當下先吞掉舊時間戳，避免畫風切回 3D 時重播上一招
  const seen = useRef({ attack: 0, range: 0, flash: 0 })
  useEffect(() => {
    seen.current.attack = motion?.attackAt ?? 0
    seen.current.range = motion?.rangeAttackAt ?? 0
    seen.current.flash = (entity === 'player' ? battleWorld.playerFlashUntil : battleWorld.enemyFlashUntil) || 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 程序式退路（無對應片段時）：0→1 的一次性計時
  const proc = useRef({ attack: 1, hit: 1 })

  const startLoop = (name: string | null) => {
    if (cur.current === name) return
    if (cur.current) actions[cur.current]?.fadeOut(LOOP_FADE)
    if (name) {
      const a = actions[name]
      if (a) {
        a.reset()
        a.setLoop(LoopRepeat, Infinity)
        a.fadeIn(LOOP_FADE).play()
      }
    }
    cur.current = name
  }

  const fireOneShot = (role: OneShotRole) => {
    const a = actions[role]
    if (!a) {
      // 無片段 → 程序式：攻擊前傾 / 受擊後仰
      if (role === 'damage') proc.current.hit = 0
      else proc.current.attack = 0
      return
    }
    if (oneShot.current && oneShot.current !== role) actions[oneShot.current]?.fadeOut(ONE_FADE)
    oneShot.current = role
    if (cur.current) actions[cur.current]?.fadeOut(ONE_FADE)
    cur.current = null
    a.reset()
    a.setLoop(LoopOnce, 1)
    a.clampWhenFinished = true
    a.fadeIn(0.08).play()
  }

  // 一次性動作播完 → 交回底層循環；down01_start 播完 → 接 down01_loop（無則停格最後一幀）
  useEffect(() => {
    const onFinished = (e: { action: AnimationAction }) => {
      const name = e.action.getClip().name
      if (name === 'downStart') {
        const loop = actions.downLoop
        if (loop) {
          e.action.fadeOut(LOOP_FADE)
          loop.reset()
          loop.setLoop(LoopRepeat, Infinity)
          loop.fadeIn(LOOP_FADE).play()
        }
        return // clampWhenFinished 已停格，無 loop 時就維持倒地姿勢
      }
      if (oneShot.current && name === oneShot.current) {
        e.action.fadeOut(ONE_FADE)
        oneShot.current = null
        cur.current = null // 下一幀由狀態機重新 fade in 底層循環
      }
    }
    mixer.addEventListener('finished', onFinished)
    return () => mixer.removeEventListener('finished', onFinished)
  }, [mixer, actions])

  const flashing = useRef(false)
  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return

    // —— 白閃（受擊）——
    let flashUntil = 0
    if (entity) {
      flashUntil = entity === 'player' ? battleWorld.playerFlashUntil : battleWorld.enemyFlashUntil
      const shouldFlash = performance.now() < flashUntil
      if (shouldFlash !== flashing.current) {
        flashing.current = shouldFlash
        for (const f of flashMats) {
          if (shouldFlash) {
            f.mat.emissive.setRGB(1, 1, 1)
            f.mat.emissiveIntensity = 1.6
          } else {
            f.mat.emissive.copy(f.emissive)
            f.mat.emissiveIntensity = f.intensity
          }
        }
      }
    }

    // —— 骨骼動畫狀態機 ——
    const state = motion?.state ?? 'idle'
    if (state === 'ko') {
      if (!koActive.current) {
        koActive.current = true
        oneShot.current = null
        if (cur.current) actions[cur.current]?.fadeOut(LOOP_FADE)
        cur.current = null
        const start = actions.downStart
        const loop = actions.downLoop
        if (start) {
          start.reset()
          start.setLoop(LoopOnce, 1)
          start.clampWhenFinished = true
          start.fadeIn(ONE_FADE).play()
        } else if (loop) {
          loop.reset()
          loop.setLoop(LoopRepeat, Infinity)
          loop.fadeIn(LOOP_FADE).play()
        }
      }
    } else {
      if (koActive.current) {
        // 再戰：收掉倒地動作，回到待機
        koActive.current = false
        actions.downStart?.fadeOut(LOOP_FADE)
        actions.downLoop?.fadeOut(LOOP_FADE)
        cur.current = null
      }
      if (motion) {
        // 一次性觸發：攻擊 / 遠攻（時間戳） + 受擊（白閃時間戳前移）
        if (motion.attackAt > seen.current.attack) {
          seen.current.attack = motion.attackAt
          fireOneShot('attack')
        }
        if (motion.rangeAttackAt > seen.current.range) {
          seen.current.range = motion.rangeAttackAt
          fireOneShot('rangeattack')
        }
        if (flashUntil > seen.current.flash) {
          seen.current.flash = flashUntil
          fireOneShot('damage')
        }
      }
      // 底層循環：move ↔ idle（無 move 片段退回 idle；全無片段則不播）
      if (!oneShot.current) {
        const want = state === 'move' && roles.move ? 'move' : roles.idle ? 'idle' : null
        startLoop(want)
      }
    }

    // —— 程序式退路：待機浮動（有真 idle 片段時關閉）+ 攻擊前傾 + 受擊後仰 ——
    const proceduralIdle = bob && !roles.idle
    g.position.y = proceduralIdle ? idleBob(clock.elapsedTime, 0, 0.08) : 0
    let rotX = 0
    let pulse = 0
    if (proc.current.attack < 1) {
      proc.current.attack = Math.min(1, proc.current.attack + dt / 0.3)
      const k = Math.sin(proc.current.attack * Math.PI)
      rotX += 0.38 * k
      pulse += 0.1 * k
    }
    if (proc.current.hit < 1) {
      proc.current.hit = Math.min(1, proc.current.hit + dt / 0.25)
      rotX -= 0.26 * Math.sin(proc.current.hit * Math.PI)
    }
    g.rotation.x = rotX
    const s = 1 + pulse
    g.scale.set(s, s, s)
  })

  return <group ref={group}><primitive object={model} /></group>
}
