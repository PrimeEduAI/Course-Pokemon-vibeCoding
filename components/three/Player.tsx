'use client'
import { useKeyboardControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { Group, Vector3 } from 'three'
import { dirFromKeys, type KeyState } from '@/lib/movement'
import PokemonModel from './PokemonModel'

const SPEED = 6
const camTarget = new Vector3()

export default function Player({ dexId }: { dexId: number }) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const [, getKeys] = useKeyboardControls<keyof KeyState>()

  useFrame(({ camera }) => {
    if (!body.current) return
    const [x, z] = dirFromKeys(getKeys())
    const vel = body.current.linvel()
    body.current.setLinvel({ x: x * SPEED, y: vel.y, z: z * SPEED }, true)
    // 面向移動方向
    if ((x !== 0 || z !== 0) && visual.current) {
      visual.current.rotation.y = Math.atan2(x, z)
    }
    // 鏡頭跟隨
    const p = body.current.translation()
    camTarget.set(p.x, p.y + 5, p.z + 10)
    camera.position.lerp(camTarget, 0.08)
    camera.lookAt(p.x, p.y + 1, p.z)
  })

  return (
    <RigidBody ref={body} colliders={false} lockRotations position={[0, 1, 6]}>
      <CapsuleCollider args={[0.5, 0.5]} />
      <group ref={visual}>
        <group position={[0, -1, 0]}>
          <PokemonModel dexId={dexId} />
        </group>
      </group>
    </RigidBody>
  )
}
