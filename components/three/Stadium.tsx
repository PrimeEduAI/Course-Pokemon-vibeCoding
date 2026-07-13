'use client'
import { useMemo } from 'react'
import { BufferGeometry, DoubleSide } from 'three'
import { ellipseRing, type Tier } from './arenas/geometry'
import Crowd from './arenas/Crowd'

export const WYNDON_TIERS: Tier[] = [
  { aIn: 25.0, bIn: 17.5, yBase: 2.4, depth: 6.5, rise: 3.4, rows: 9 },
  { aIn: 32.2, bIn: 24.7, yBase: 6.8, depth: 6.5, rise: 3.6, rows: 9 },
  { aIn: 39.4, bIn: 31.9, yBase: 11.5, depth: 7.5, rise: 4.6, rows: 11 },
]

const MAGENTA = '#ff2d78'

function StandShell() {
  const geos = useMemo(() => {
    const slopes: BufferGeometry[] = []
    const walls: BufferGeometry[] = []
    const trims: BufferGeometry[] = []
    let prevAOut = WYNDON_TIERS[0].aIn
    let prevBOut = WYNDON_TIERS[0].bIn
    let prevYTop = -0.5
    for (const t of WYNDON_TIERS) {
      const aOut = t.aIn + t.depth
      const bOut = t.bIn + t.depth
      const yTop = t.yBase + t.rise
      // 前立面牆（從前一層頂 / 地面 → 本層底）
      walls.push(ellipseRing(prevAOut, prevBOut, prevYTop, t.aIn, t.bIn, t.yBase))
      // 本層斜面
      slopes.push(ellipseRing(t.aIn, t.bIn, t.yBase, aOut, bOut, yTop))
      // 立面頂端洋紅飾條（發光）
      trims.push(ellipseRing(t.aIn - 0.04, t.bIn - 0.04, t.yBase - 0.13, t.aIn - 0.04, t.bIn - 0.04, t.yBase))
      prevAOut = aOut
      prevBOut = bOut
      prevYTop = yTop
    }
    // 頂層護欄 + 冠冕發光環
    walls.push(ellipseRing(prevAOut, prevBOut, prevYTop, prevAOut, prevBOut, prevYTop + 1.8))
    trims.push(ellipseRing(prevAOut + 0.02, prevBOut + 0.02, prevYTop + 1.62, prevAOut + 0.02, prevBOut + 0.02, prevYTop + 1.92))
    return { slopes, walls, trims }
  }, [])

  return (
    <group>
      {geos.slopes.map((g, i) => (
        <mesh key={`s${i}`} geometry={g}>
          <meshStandardMaterial color={i % 2 === 0 ? '#262a34' : '#22262f'} roughness={0.95} side={DoubleSide} />
        </mesh>
      ))}
      {geos.walls.map((g, i) => (
        <mesh key={`w${i}`} geometry={g}>
          <meshStandardMaterial color="#141821" roughness={0.9} side={DoubleSide} />
        </mesh>
      ))}
      {geos.trims.map((g, i) => (
        <mesh key={`t${i}`} geometry={g}>
          <meshBasicMaterial color={MAGENTA} toneMapped={false} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

export default function Stadium() {
  return (
    <group>
      <StandShell />
      {/* 現代風 sprite 觀眾（夜場調暗） */}
      <Crowd tiers={WYNDON_TIERS} style="modern" brightness={[0.32, 0.62]} />
    </group>
  )
}
