'use client'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Box3, Group, Mesh, Vector3 } from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { idleBob } from '@/lib/movement'

export default function PokemonModel({ dexId, targetHeight = 1.2 }: { dexId: number; targetHeight?: number }) {
  const { scene } = useGLTF(`/assets/glb/regular/${dexId}.glb`)
  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    clone.traverse((o) => { if (o instanceof Mesh) o.castShadow = true })
    const size = new Box3().setFromObject(clone).getSize(new Vector3())
    clone.scale.setScalar(size.y > 0 ? targetHeight / size.y : 1)
    // 縮放後重算：腳貼地（y=0）、XZ 置中於旋轉軸
    const box = new Box3().setFromObject(clone)
    const center = box.getCenter(new Vector3())
    clone.position.set(clone.position.x - center.x, clone.position.y - box.min.y, clone.position.z - center.z)
    return clone
  }, [scene, targetHeight])
  const group = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = idleBob(clock.elapsedTime, 0, 0.08)
  })
  return <group ref={group}><primitive object={model} /></group>
}
