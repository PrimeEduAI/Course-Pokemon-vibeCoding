'use client'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Group, Mesh, Texture, Vector3 } from 'three'
import { blobShadowTexture, faceCameraYaw, flashValueFor, makeSpriteMaterial } from './spriteUtils'

interface Props {
  texture: Texture
  /** 貼圖寬高比（w/h），維持 sprite 原始比例 */
  aspect: number
  /** 顯示高度（world units），底邊貼地 y=0 */
  height: number
  entity?: 'player' | 'enemy'
  /** 經典 2 幀跳動待機（點陣模式） */
  hop?: boolean
}

/** 復古 2 幀跳動：方波式 y 位移（非平滑漂浮） */
function hopOffset(t: number): number {
  return Math.sin(t * 3.4) > 0.55 ? 0.07 : 0
}

const groundWp = new Vector3()

/**
 * Sprite 看板共用核心：Y 軸朝向相機的平面 + 圓形假陰影 + 受擊白閃。
 * castShadow 一律關閉（平面投影影子違和），陰影讀感交給 blob shadow。
 */
export default function BillboardCore({ texture, aspect, height, entity, hop = false }: Props) {
  const group = useRef<Group>(null)
  const sprite = useRef<Mesh>(null)
  const shadow = useRef<Mesh>(null)
  const uFlash = useRef({ value: 0 }).current
  const material = useMemo(() => makeSpriteMaterial(texture, uFlash), [texture, uFlash])
  useEffect(() => () => material.dispose(), [material])
  const shadowTex = useMemo(() => blobShadowTexture(), [])

  useFrame(({ camera, clock }) => {
    if (!group.current) return
    faceCameraYaw(group.current, camera)
    uFlash.value = flashValueFor(entity)
    if (sprite.current) sprite.current.position.y = height / 2 + (hop ? hopOffset(clock.elapsedTime) : 0)
    if (shadow.current) {
      // 假陰影投到地面：抵銷懸浮高度（敵方飛行浮動時影子留在地上）；KO 下沉時跟著本體
      group.current.getWorldPosition(groundWp)
      shadow.current.position.y = Math.min(0.02, 0.02 - groundWp.y)
    }
  })

  const width = height * aspect
  const shadowRadius = Math.min(0.95, Math.max(0.42, width * 0.33))
  return (
    <group ref={group}>
      <mesh ref={sprite} material={material} position={[0, height / 2, 0]}>
        <planeGeometry args={[width, height]} />
      </mesh>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position-y={0.02} renderOrder={-1}>
        <circleGeometry args={[shadowRadius, 24]} />
        <meshBasicMaterial map={shadowTex} transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  )
}
