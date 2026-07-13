'use client'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, Group, LoopRepeat, Mesh, Object3D, Vector3 } from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { idleBob } from '@/lib/movement'
import { resolveClipRoles } from '@/lib/clipRoles'
import { stripOriginXZ } from '../PokemonModel'

/**
 * 展示台專用模型載入器。
 * 與共用 PokemonModel 的差異：骨架感知的量測——部分 GLB（如 25 皮卡丘）
 * bind pose 包圍盒與實際擺姿差距極大（armature 節點帶 4.5x 縮放），
 * 用 Box3.setFromObject 會把模型縮到迷你＋浮空。這裡改用
 * Mesh.getVertexPosition（含 skinning/morph）抽樣頂點算實際包圍盒。
 */
function poseAwareBox(root: Object3D) {
  root.updateMatrixWorld(true)
  const box = new Box3()
  const v = new Vector3()
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return
    const pos = o.geometry?.attributes?.position
    if (!pos) return
    const step = Math.max(1, Math.floor(pos.count / 240))
    for (let i = 0; i < pos.count; i += step) {
      o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld)
      box.expandByPoint(v)
    }
  })
  return box
}

/** 個別素材姿態修正：25 皮卡丘的 root 帶 +90°X（z-up 素材沒轉正）→ 趴地，這裡補轉 */
const UPRIGHT_FIX_X: Record<number, number> = { 25: -Math.PI / 2 }

export default function ShowpieceModel({ dexId, targetHeight = 1.3 }: { dexId: number; targetHeight?: number }) {
  const { scene, animations } = useGLTF(`/assets/glb/regular/${dexId}.glb`)
  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    clone.traverse((o) => { if (o instanceof Mesh) o.castShadow = true })
    clone.position.set(0, 0, 0)
    clone.rotation.x = UPRIGHT_FIX_X[dexId] ?? 0
    const box = poseAwareBox(clone)
    const size = box.getSize(new Vector3())
    const s = size.y > 1e-4 ? targetHeight / size.y : 1
    clone.scale.setScalar(s)
    const center = box.getCenter(new Vector3())
    // 腳貼地（y=0）、XZ 置中於旋轉軸（box 是未縮放量測，等比換算即可）
    clone.position.set(-center.x * s, -box.min.y * s, -center.z * s)
    return clone
  }, [scene, targetHeight, dexId])

  // 展示待機動畫：有 battlewait/defaultwait 循環片段就播（如 658 甲賀忍蛙），
  // 沒有（如 25 皮卡丘只有攻擊手勢）維持 bind pose + idleBob 浮動
  const idleClips = useMemo(() => {
    const roles = resolveClipRoles(animations.map((a) => ({ name: a.name, duration: a.duration })))
    if (!roles.idle) return []
    const src = animations.find((a) => a.name === roles.idle)
    if (!src) return []
    const c = src.clone()
    c.name = 'idle'
    stripOriginXZ(c) // 保險：待機循環若烘了 root motion，把 XZ 釘住
    return [c]
  }, [animations])

  const group = useRef<Group>(null)
  const { actions } = useAnimations(idleClips, group)
  const hasIdle = idleClips.length > 0
  useEffect(() => {
    const a = actions.idle
    if (!a) return
    a.reset()
    a.setLoop(LoopRepeat, Infinity)
    a.fadeIn(0.3).play()
    return () => { a.fadeOut(0.2) }
  }, [actions])

  useFrame(({ clock }) => {
    // 有真待機動畫時關閉程序式浮動（骨骼自己會呼吸）
    if (group.current && !hasIdle) group.current.position.y = idleBob(clock.elapsedTime, 0, 0.08)
  })
  return <group ref={group}><primitive object={model} /></group>
}
