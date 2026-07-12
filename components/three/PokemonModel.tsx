'use client'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group } from 'three'
import { idleBob } from '@/lib/movement'

export default function PokemonModel({ dexId, scale = 1 }: { dexId: number; scale?: number }) {
  const { scene } = useGLTF(`/assets/glb/regular/${dexId}.glb`)
  const group = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = idleBob(clock.elapsedTime, 0, 0.08)
  })
  return <group ref={group}><primitive object={scene} scale={scale} /></group>
}
