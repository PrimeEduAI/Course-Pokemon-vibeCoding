'use client'
import { CuboidCollider, RigidBody } from '@react-three/rapier'

export default function ArenaFloor() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[20, 0.25, 12]} position={[0, -0.25, 0]} />
      <mesh receiveShadow position={[0, -0.25, 0]}>
        <boxGeometry args={[40, 0.5, 24]} />
        <meshStandardMaterial color="#8a6f4d" />
      </mesh>
      {/* Poké Ball 中圈（純視覺，無碰撞） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.8, 3.2, 64]} />
        <meshStandardMaterial color="#e8e4da" />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <planeGeometry args={[40, 0.4]} />
        <meshStandardMaterial color="#e8e4da" />
      </mesh>
    </RigidBody>
  )
}
