'use client'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'
import type { Tier } from './geometry'
import { makeCrowdSheet, SHEET_COLS, SHEET_ROWS, VARIANT_COUNT, type CrowdStyle } from './crowdTexture'

interface CrowdProps {
  tiers: Tier[]
  style: CrowdStyle
  /** sprite 亮度乘數範圍（夜場調暗、日場調亮） */
  brightness: [number, number]
  /** 同排座位間距（公尺） */
  spacing?: number
}

/**
 * 觀眾：單一 InstancedMesh billboard 小人。
 * - 每 instance 用 aVariant 挑 sprite sheet 的 1/16 cell
 * - 頂點著色器做視空間 billboard + 便宜的跳動動畫（沿用原方塊觀眾的 GPU 動畫思路）
 */
export default function Crowd({ tiers, style, brightness, spacing = 0.62 }: CrowdProps) {
  const uTime = useMemo(() => ({ value: 0 }), [])

  const mesh = useMemo(() => {
    type P = { x: number; y: number; z: number; s: number }
    const list: P[] = []
    for (const t of tiers) {
      for (let r = 0; r < t.rows; r++) {
        const f = (r + 0.5) / t.rows
        const a = t.aIn + f * t.depth
        const b = t.bIn + f * t.depth
        const y = t.yBase + f * t.rise + 0.3
        const perim = 2 * Math.PI * Math.sqrt((a * a + b * b) / 2)
        const n = Math.floor(perim / spacing)
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.1) continue // 零星空位
          const ang = (i / n) * Math.PI * 2 + Math.random() * 0.008
          list.push({
            x: Math.cos(ang) * a + (Math.random() - 0.5) * 0.16,
            y: y + (Math.random() - 0.5) * 0.06,
            z: Math.sin(ang) * b + (Math.random() - 0.5) * 0.16,
            s: 0.85 + Math.random() * 0.3,
          })
        }
      }
    }

    // 貼底的 billboard quad（sprite 比例 3:4）
    const h = style === 'gba' ? 0.88 : 0.96
    const geo = new PlaneGeometry(h * 0.75, h)
    geo.translate(0, h / 2, 0)
    const variants = new Float32Array(list.length)
    for (let i = 0; i < list.length; i++) variants[i] = (Math.random() * VARIANT_COUNT) | 0
    geo.setAttribute('aVariant', new InstancedBufferAttribute(variants, 1))

    const tex = makeCrowdSheet(style)
    const mat = new MeshBasicMaterial({ map: tex, alphaTest: 0.4 })
    const cw = (1 / SHEET_COLS).toFixed(4)
    const ch = (1 / SHEET_ROWS).toFixed(4)
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = `uniform float uTime;\nattribute float aVariant;\n${shader.vertexShader
        .replace(
          '#include <uv_vertex>',
          [
            '#include <uv_vertex>',
            '#ifdef USE_MAP',
            `vMapUv = vMapUv * vec2(${cw}, ${ch}) + vec2(mod(aVariant, ${SHEET_COLS}.0) * ${cw}, floor(aVariant / ${SHEET_COLS}.0) * ${ch});`,
            '#endif',
          ].join('\n'),
        )
        .replace(
          '#include <project_vertex>',
          [
            // 視空間 billboard：instance 原點投到視空間後直接加上 quad 的局部 XY
            'vec4 mvPosition = modelViewMatrix * (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0));',
            'float cScl = length(instanceMatrix[0].xyz);',
            'float ph = float(gl_InstanceID);',
            'float hop = step(0.62, fract(ph * 0.6180339)) * (0.5 + 0.5 * sin(uTime * (2.2 + mod(ph, 2.6)) + ph * 1.7)) * 0.2;',
            'mvPosition.xy += transformed.xy * cScl;',
            'mvPosition.y += hop;',
            'gl_Position = projectionMatrix * mvPosition;',
          ].join('\n'),
        )}`
    }
    // 兩種 style 的 shader 相同但 uniform 綁定不同 → 用 style 當 cache key 一部分沒必要，
    // three 以 onBeforeCompile.toString() 參與快取；uniforms 本就 per-material。

    const m = new InstancedMesh(geo, mat, list.length)
    const mat4 = new Matrix4()
    const q = new Quaternion()
    const v = new Vector3()
    const sc = new Vector3()
    const color = new Color()
    const [bMin, bMax] = brightness
    list.forEach((p, i) => {
      v.set(p.x, p.y, p.z)
      sc.set(p.s, p.s, p.s)
      mat4.compose(v, q, sc)
      m.setMatrixAt(i, mat4)
      color.setScalar(bMin + Math.random() * (bMax - bMin))
      m.setColorAt(i, color)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.frustumCulled = false
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uTime, style, spacing, brightness[0], brightness[1]])

  useFrame(({ clock }) => {
    uTime.value = clock.elapsedTime
  })

  return <primitive object={mesh} />
}
