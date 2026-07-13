'use client'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Box3, Color, Group, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh, Vector3 } from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { idleBob } from '@/lib/movement'
import { battleWorld } from '@/stores/battleWorld'

interface Props {
  dexId: number
  targetHeight?: number
  /** 指定戰鬥實體 → 材質獨立複製，受擊時白閃 */
  entity?: 'player' | 'enemy'
  /** 關閉待機浮動（由外層控制動畫時使用） */
  bob?: boolean
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

export default function PokemonModel({ dexId, targetHeight = 1.2, entity, bob = true }: Props) {
  const { scene } = useGLTF(`/assets/glb/regular/${dexId}.glb`)
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
  const group = useRef<Group>(null)
  const flashing = useRef(false)
  useFrame(({ clock }) => {
    if (group.current && bob) group.current.position.y = idleBob(clock.elapsedTime, 0, 0.08)
    if (entity) {
      const until = entity === 'player' ? battleWorld.playerFlashUntil : battleWorld.enemyFlashUntil
      const now = performance.now()
      const shouldFlash = now < until
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
  })
  return <group ref={group}><primitive object={model} /></group>
}
