'use client'
import { Environment } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { ellipseRing, type Tier } from './geometry'
import Crowd from './Crowd'
import type { FieldType } from './types'

/**
 * Gen 7 瑪納羅大會（阿羅拉聯盟）：
 * 黃金時刻的海上露天球場 —— 四面環海（GPU 波浪 + 日落反光）、
 * 白色貝殼場館環、熱帶節慶三角旗與花環、тiki 火炬、遠方島嶼剪影、
 * 上空盤旋的守護神發光剪影。
 */

// 單層低矮看台：讓落日與天空從觀眾席上方灑進場內（露天海上球場）
const G7_TIERS: Tier[] = [
  { aIn: 25.0, bIn: 17.5, yBase: 2.0, depth: 9.0, rise: 3.6, rows: 13 },
]
const RIM_A = G7_TIERS[0].aIn + G7_TIERS[0].depth
const RIM_B = G7_TIERS[0].bIn + G7_TIERS[0].depth
const RIM_Y = G7_TIERS[0].yBase + G7_TIERS[0].rise
const RAIL_TOP = RIM_Y + 1.4

const SHELL_A = '#f2ece0'
const SHELL_B = '#e8e0d0'
const SHELL_WALL = '#ddd2bc'
const CORAL = '#ff6a5a'

function gen7Rng(seed: number) {
  let s = (seed * 2654435761) % 4294967296
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/* ---------- 日落天空 + 太陽 + 島嶼剪影 ---------- */

function gen7MakeSky(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#3c4a8c')
  grad.addColorStop(0.4, '#7a62a0')
  grad.addColorStop(0.62, '#c97a78')
  grad.addColorStop(0.78, '#f09a58')
  grad.addColorStop(0.88, '#ffbe78')
  grad.addColorStop(0.95, '#f7b48c')
  grad.addColorStop(1, '#eda182')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 512)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function gen7MakeIslands(): CanvasTexture {
  const W = 1024
  const H = 128
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  g.fillStyle = '#46284e'
  // 幾座圓潤的火山島剪影（首尾同高無縫）
  const hump = (cx: number, w: number, h: number) => {
    g.beginPath()
    g.moveTo(cx - w, H)
    g.quadraticCurveTo(cx - w * 0.4, H - h, cx, H - h)
    g.quadraticCurveTo(cx + w * 0.4, H - h, cx + w, H)
    g.closePath()
    g.fill()
  }
  hump(140, 130, 58)
  hump(300, 80, 34)
  hump(560, 170, 76)
  hump(700, 70, 26)
  hump(880, 110, 46)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.repeat.x = 2
  return tex
}

function gen7MakeGlow(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255, 235, 200, 0.95)')
  grad.addColorStop(0.3, 'rgba(255, 190, 110, 0.4)')
  grad.addColorStop(1, 'rgba(255, 160, 70, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

function Gen7Sky() {
  const sky = useMemo(() => gen7MakeSky(), [])
  const islands = useMemo(() => gen7MakeIslands(), [])
  const glow = useMemo(() => gen7MakeGlow(), [])
  return (
    <>
      <color attach="background" args={['#f2a679']} />
      <fog attach="fog" args={['#eda182', 150, 520]} />
      <mesh>
        <sphereGeometry args={[420, 24, 16]} />
        <meshBasicMaterial map={sky} side={BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* 低垂落日 + 巨大光暈 */}
      <group position={[-125, 54, -310]} onUpdate={(g: Group) => g.lookAt(0, 10, 0)}>
        <mesh>
          <circleGeometry args={[26, 32]} />
          <meshBasicMaterial color={[4.2, 2.5, 1.1]} toneMapped={false} fog={false} />
        </mesh>
        <mesh position={[0, 0, -1]}>
          <planeGeometry args={[190, 190]} />
          <meshBasicMaterial map={glow} transparent blending={AdditiveBlending} depthWrite={false} fog={false} />
        </mesh>
      </group>
      {/* 遠方島嶼剪影環 */}
      <mesh position={[0, 15, 0]}>
        <cylinderGeometry args={[345, 345, 52, 48, 1, true]} />
        <meshBasicMaterial map={islands} transparent alphaTest={0.5} side={BackSide} fog={false} />
      </mesh>
    </>
  )
}

/* ---------- 海洋（GPU 波浪 + 日落高光 + 波光層） ---------- */

function gen7MakeSparkleTex(): CanvasTexture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  g.clearRect(0, 0, S, S)
  const r = gen7Rng(777)
  for (let i = 0; i < 240; i++) {
    const x = r() * S
    const y = r() * S
    const w = 2 + r() * 9
    g.fillStyle = `rgba(255, 226, 180, ${0.12 + r() * 0.5})`
    g.fillRect(x, y, w, 1.4 + r() * 1.2)
  }
  const tex = new CanvasTexture(c)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(11, 11)
  return tex
}

function Gen7Ocean() {
  const uTime = useMemo(() => ({ value: 0 }), [])
  const sparkleTex = useMemo(() => gen7MakeSparkleTex(), [])

  const oceanMat = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: new Color('#175a72'),
      metalness: 0.5,
      roughness: 0.34,
      envMapIntensity: 1.6,
    })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          [
            'float wp1 = 0.09 * position.x + uTime * 0.9;',
            'float wp2 = 0.16 * position.y - uTime * 0.7;',
            'float wp3 = 0.05 * (position.x + position.y) + uTime * 0.48;',
            'float wdx = 0.75 * 0.09 * cos(wp1) + 0.35 * 0.05 * cos(wp3);',
            'float wdy = 0.5 * 0.16 * cos(wp2) + 0.35 * 0.05 * cos(wp3);',
            'vec3 objectNormal = normalize(vec3(-wdx, -wdy, 1.0));',
            '#ifdef USE_TANGENT',
            'vec3 objectTangent = vec3( tangent.xyz );',
            '#endif',
          ].join('\n'),
        )
        .replace(
          '#include <begin_vertex>',
          'vec3 transformed = vec3(position.xy, position.z + 0.75 * sin(wp1) + 0.5 * sin(wp2) + 0.35 * sin(wp3));',
        )}`
    }
    return mat
  }, [uTime])

  useFrame(({ clock }) => {
    uTime.value = clock.elapsedTime
    sparkleTex.offset.x = clock.elapsedTime * 0.008
    sparkleTex.offset.y = clock.elapsedTime * 0.005
  })

  return (
    <group>
      {/* 海面（GPU 波浪；一路鋪到霧線之外 = 四面環海） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.4, 0]} material={oceanMat}>
        <planeGeometry args={[1040, 1040, 84, 84]} />
      </mesh>
      {/* 波光鱗片（加法混合緩慢漂移） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.78, 0]}>
        <planeGeometry args={[420, 420]} />
        <meshBasicMaterial
          map={sparkleTex}
          color={[1.6, 1.2, 0.72]}
          transparent
          opacity={0.22}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/* ---------- 白色貝殼場館 ---------- */

function Gen7Stands() {
  const geos = useMemo(() => {
    const slopes: BufferGeometry[] = []
    const walls: BufferGeometry[] = []
    const trims: BufferGeometry[] = []
    let prevAOut = G7_TIERS[0].aIn
    let prevBOut = G7_TIERS[0].bIn
    let prevYTop = -0.5
    for (const t of G7_TIERS) {
      const aOut = t.aIn + t.depth
      const bOut = t.bIn + t.depth
      const yTop = t.yBase + t.rise
      walls.push(ellipseRing(prevAOut, prevBOut, prevYTop, t.aIn, t.bIn, t.yBase))
      slopes.push(ellipseRing(t.aIn, t.bIn, t.yBase, aOut, bOut, yTop))
      trims.push(ellipseRing(t.aIn - 0.04, t.bIn - 0.04, t.yBase - 0.45, t.aIn - 0.04, t.bIn - 0.04, t.yBase))
      prevAOut = aOut
      prevBOut = bOut
      prevYTop = yTop
    }
    walls.push(ellipseRing(RIM_A, RIM_B, RIM_Y, RIM_A, RIM_B, RAIL_TOP))
    // 貝殼簷篷：頂圈向外下斜
    const canopy = ellipseRing(RIM_A, RIM_B, RAIL_TOP, RIM_A + 6.2, RIM_B + 6.2, RAIL_TOP - 2.4)
    // 船體裙板：看台底向外下收至海面
    const hull = ellipseRing(RIM_A + 1.5, RIM_B + 1.5, 2.2, RIM_A - 3.2, RIM_B - 3.2, -2.6)
    return { slopes, walls, trims, canopy, hull }
  }, [])

  const fins = useMemo(() => {
    const N = 24
    const m = new InstancedMesh(
      new BoxGeometry(0.7, 3.4, 5.4),
      new MeshStandardMaterial({ color: '#f6f0e4', roughness: 0.55 }),
      N,
    )
    const m4 = new Matrix4()
    const q = new Quaternion()
    const e = new Euler()
    const pos = new Vector3()
    const sc = new Vector3(1, 1, 1)
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2
      const x = Math.cos(ang) * (RIM_A + 2.6)
      const z = Math.sin(ang) * (RIM_B + 2.6)
      pos.set(x, RAIL_TOP - 1.0, z)
      e.set(0.42, -ang + Math.PI / 2, 0, 'YXZ')
      q.setFromEuler(e)
      m4.compose(pos, q, sc)
      m.setMatrixAt(i, m4)
    }
    m.instanceMatrix.needsUpdate = true
    m.frustumCulled = false
    return m
  }, [])

  return (
    <group>
      {geos.slopes.map((g, i) => (
        <mesh key={`s${i}`} geometry={g}>
          <meshStandardMaterial color={i % 2 === 0 ? SHELL_A : SHELL_B} roughness={0.8} side={DoubleSide} />
        </mesh>
      ))}
      {geos.walls.map((g, i) => (
        <mesh key={`w${i}`} geometry={g}>
          <meshStandardMaterial color={SHELL_WALL} roughness={0.75} side={DoubleSide} />
        </mesh>
      ))}
      {geos.trims.map((g, i) => (
        <mesh key={`t${i}`} geometry={g}>
          <meshStandardMaterial color={CORAL} roughness={0.6} side={DoubleSide} />
        </mesh>
      ))}
      {/* 貝殼簷篷 + 白色鰭肋 */}
      <mesh geometry={geos.canopy}>
        <meshStandardMaterial color="#faf5ea" roughness={0.5} side={DoubleSide} />
      </mesh>
      <primitive object={fins} />
      {/* 船體裙板（沒入海面） */}
      <mesh geometry={geos.hull}>
        <meshStandardMaterial color="#e2d8c4" roughness={0.7} side={DoubleSide} />
      </mesh>
    </group>
  )
}

/* ---------- 節慶三角旗 + 花環 ---------- */

const G7_POLE_COUNT = 10
const G7_FLAGS_PER_SPAN = 11
const G7_FLAG_COLORS = ['#ff5a76', '#ffd166', '#2ec4b6', '#f8f4e8', '#ff8c42', '#9d6bce']
const G7_LEI_COLORS = ['#ff85a1', '#ffd166', '#f8f4e8', '#ff5a76']

function Gen7Festival() {
  const uTime = useMemo(() => ({ value: 0 }), [])

  const { flags, strings, poles, leis } = useMemo(() => {
    const tops: Vector3[] = []
    for (let i = 0; i < G7_POLE_COUNT; i++) {
      const ang = (i / G7_POLE_COUNT) * Math.PI * 2
      tops.push(new Vector3(Math.cos(ang) * (RIM_A - 0.6), RAIL_TOP + 2.6, Math.sin(ang) * (RIM_B - 0.6)))
    }

    const tri = new BufferGeometry()
    tri.setAttribute('position', new Float32BufferAttribute([-0.19, 0, 0, 0.19, 0, 0, 0, -0.55, 0], 3))
    tri.computeVertexNormals()

    const mat = new MeshBasicMaterial({ side: DoubleSide })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'float fph = float(gl_InstanceID);',
          'transformed.z += sin(uTime * 3.4 + fph * 1.31 + transformed.y * 4.0) * (-transformed.y) * 0.55;',
        ].join('\n'),
      )}`
    }

    const flagMesh = new InstancedMesh(tri, mat, G7_POLE_COUNT * G7_FLAGS_PER_SPAN)
    const m4 = new Matrix4()
    const q = new Quaternion()
    const e = new Euler()
    const pos = new Vector3()
    const sc = new Vector3(1, 1, 1)
    const color = new Color()
    const stringPts: number[] = []
    let fi = 0
    for (let i = 0; i < G7_POLE_COUNT; i++) {
      const a = tops[i]
      const b = tops[(i + 1) % G7_POLE_COUNT]
      const dir = new Vector3().subVectors(b, a)
      const yaw = Math.atan2(-dir.z, dir.x)
      let prev: Vector3 | null = null
      for (let s = 0; s <= 10; s++) {
        const t = s / 10
        const p = new Vector3().lerpVectors(a, b, t)
        p.y -= Math.sin(Math.PI * t) * 1.0
        if (prev) stringPts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z)
        prev = p
      }
      for (let j = 0; j < G7_FLAGS_PER_SPAN; j++) {
        const t = (j + 0.5) / G7_FLAGS_PER_SPAN
        pos.lerpVectors(a, b, t)
        pos.y -= Math.sin(Math.PI * t) * 1.0
        e.set(0, yaw, 0)
        q.setFromEuler(e)
        m4.compose(pos, q, sc)
        flagMesh.setMatrixAt(fi, m4)
        color.set(G7_FLAG_COLORS[(i + j) % G7_FLAG_COLORS.length])
        flagMesh.setColorAt(fi, color)
        fi++
      }
    }
    flagMesh.instanceMatrix.needsUpdate = true
    if (flagMesh.instanceColor) flagMesh.instanceColor.needsUpdate = true
    flagMesh.frustumCulled = false

    const stringGeo = new BufferGeometry()
    stringGeo.setAttribute('position', new Float32BufferAttribute(stringPts, 3))

    // 旗桿
    const poleMesh = (() => {
      const geoH = 2.8
      const m = new InstancedMesh(
        new CylinderGeometry(0.07, 0.1, geoH, 6),
        new MeshStandardMaterial({ color: '#b08a58', roughness: 0.85 }),
        G7_POLE_COUNT,
      )
      const mm = new Matrix4()
      tops.forEach((p, i) => {
        mm.makeTranslation(p.x, p.y - geoH / 2 + 0.1, p.z)
        m.setMatrixAt(i, mm)
      })
      m.instanceMatrix.needsUpdate = true
      m.frustumCulled = false
      return m
    })()

    // 花環（每跨較低的第二道弧線掛花球）
    const leiMesh = (() => {
      const perSpan = 14
      const m = new InstancedMesh(
        new SphereGeometry(0.16, 6, 5),
        new MeshBasicMaterial(),
        G7_POLE_COUNT * perSpan,
      )
      const mm = new Matrix4()
      const cc = new Color()
      let k = 0
      for (let i = 0; i < G7_POLE_COUNT; i++) {
        const a = tops[i]
        const b = tops[(i + 1) % G7_POLE_COUNT]
        for (let j = 0; j < perSpan; j++) {
          const t = (j + 0.5) / perSpan
          const p = new Vector3().lerpVectors(a, b, t)
          p.y -= Math.sin(Math.PI * t) * 1.55 + 0.25
          mm.makeTranslation(p.x, p.y, p.z)
          m.setMatrixAt(k, mm)
          cc.set(G7_LEI_COLORS[(i * 3 + j) % G7_LEI_COLORS.length]).multiplyScalar(0.95)
          m.setColorAt(k, cc)
          k++
        }
      }
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      m.frustumCulled = false
      return m
    })()

    return { flags: flagMesh, strings: stringGeo, poles: poleMesh, leis: leiMesh }
  }, [uTime])

  useFrame(({ clock }) => {
    uTime.value = clock.elapsedTime
  })

  return (
    <group>
      <primitive object={flags} />
      <primitive object={poles} />
      <primitive object={leis} />
      <lineSegments geometry={strings}>
        <lineBasicMaterial color="#e8dcc2" />
      </lineSegments>
    </group>
  )
}

/* ---------- Tiki 火炬 ---------- */

function gen7MakeFlameSheet(): CanvasTexture {
  const FRAMES = 8
  const FW = 96
  const FH = 192
  const c = document.createElement('canvas')
  c.width = FRAMES * FW
  c.height = FH
  const g = c.getContext('2d')!
  g.clearRect(0, 0, c.width, c.height)
  const tongue = (ox: number, cx: number, baseY: number, w: number, h: number, colr: string, alpha: number) => {
    g.globalAlpha = alpha
    g.fillStyle = colr
    g.beginPath()
    g.moveTo(ox + cx, baseY - h)
    g.bezierCurveTo(ox + cx + w * 0.72, baseY - h * 0.55, ox + cx + w * 0.62, baseY - h * 0.08, ox + cx, baseY)
    g.bezierCurveTo(ox + cx - w * 0.62, baseY - h * 0.08, ox + cx - w * 0.72, baseY - h * 0.55, ox + cx, baseY - h)
    g.closePath()
    g.fill()
  }
  for (let f = 0; f < FRAMES; f++) {
    const ox = f * FW
    const j = (n: number) => Math.sin(f * 2.4 + n * 1.7)
    const baseY = FH - 8
    tongue(ox, 48 + j(1) * 5, baseY, 40, 148 + j(2) * 18, '#ff6a10', 0.85)
    tongue(ox, 48 + j(3) * 6, baseY, 28, 110 + j(4) * 14, '#ffa030', 0.9)
    tongue(ox, 48 + j(5) * 4, baseY, 18, 72 + j(6) * 11, '#ffdf70', 0.95)
  }
  g.globalAlpha = 1
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.repeat.set(1 / FRAMES, 1)
  tex.magFilter = NearestFilter
  return tex
}

const G7_TORCHES: [number, number][] = [
  [23.2, 14.6],
  [-23.2, 14.6],
  [23.2, -14.6],
  [-23.2, -14.6],
  [0, 15.8],
  [0, -15.8],
]

function Gen7Torches() {
  const tex = useMemo(() => gen7MakeFlameSheet(), [])
  const lights = useRef<(PointLight | null)[]>([])

  const { poles, bowls, flames } = useMemo(() => {
    const m4 = new Matrix4()
    const q = new Quaternion()
    const pos = new Vector3()
    const sc = new Vector3(1, 1, 1)
    const up = new Vector3(0, 1, 0)

    const poleMesh = new InstancedMesh(
      new CylinderGeometry(0.16, 0.26, 2.6, 7),
      new MeshStandardMaterial({ color: '#7a5a34', roughness: 0.9 }),
      G7_TORCHES.length,
    )
    const bowlMesh = new InstancedMesh(
      new CylinderGeometry(0.62, 0.3, 0.6, 8),
      new MeshStandardMaterial({ color: '#5a4024', roughness: 0.8 }),
      G7_TORCHES.length,
    )
    G7_TORCHES.forEach(([x, z], i) => {
      m4.makeTranslation(x, 0.8, z)
      poleMesh.setMatrixAt(i, m4)
      m4.makeTranslation(x, 2.2, z)
      bowlMesh.setMatrixAt(i, m4)
    })
    poleMesh.instanceMatrix.needsUpdate = true
    bowlMesh.instanceMatrix.needsUpdate = true
    poleMesh.frustumCulled = false
    bowlMesh.frustumCulled = false

    const flameGeo = new PlaneGeometry(1.3, 2.3)
    flameGeo.translate(0, 1.15, 0)
    const flameMat = new MeshBasicMaterial({
      map: tex,
      color: new Color(2.2, 1.5, 0.9),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
      fog: false,
    })
    const flameMesh = new InstancedMesh(flameGeo, flameMat, G7_TORCHES.length * 2)
    let fi = 0
    for (const [x, z] of G7_TORCHES) {
      for (const ry of [0, Math.PI / 2]) {
        pos.set(x, 2.4, z)
        q.setFromAxisAngle(up, ry)
        m4.compose(pos, q, sc)
        flameMesh.setMatrixAt(fi, m4)
        fi++
      }
    }
    flameMesh.instanceMatrix.needsUpdate = true
    flameMesh.frustumCulled = false
    return { poles: poleMesh, bowls: bowlMesh, flames: flameMesh }
  }, [tex])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    tex.offset.x = (Math.floor(t * 10) % 8) / 8
    lights.current.forEach((l, i) => {
      if (l) l.intensity = 7 + Math.sin(t * 8.7 + i * 2.1) * 2 + Math.sin(t * 19.3 + i) * 1.2
    })
  })

  return (
    <group>
      <primitive object={poles} />
      <primitive object={bowls} />
      <primitive object={flames} />
      {/* 只給四角火炬掛光源，控制燈數 */}
      {G7_TORCHES.slice(0, 4).map(([x, z], i) => (
        <pointLight
          key={i}
          ref={(l) => { lights.current[i] = l }}
          position={[x, 3.2, z]}
          color="#ff9a40"
          distance={14}
          decay={1.9}
          intensity={7}
        />
      ))}
    </group>
  )
}

/* ---------- 守護神發光剪影 ---------- */

function gen7MakeGuardianTex(): CanvasTexture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  g.clearRect(0, 0, S, S)
  const cx = S / 2
  g.strokeStyle = '#ffcf60'
  g.shadowColor = '#ff9a30'
  g.shadowBlur = 26
  g.lineWidth = 6
  g.lineJoin = 'round'

  // 中央梭形盾殼
  g.beginPath()
  g.moveTo(cx, 90)
  g.quadraticCurveTo(cx + 92, 210, cx, 400)
  g.quadraticCurveTo(cx - 92, 210, cx, 90)
  g.closePath()
  g.stroke()
  // 盾殼內紋
  g.lineWidth = 3.5
  g.beginPath()
  g.moveTo(cx, 130)
  g.quadraticCurveTo(cx + 58, 220, cx, 358)
  g.quadraticCurveTo(cx - 58, 220, cx, 130)
  g.closePath()
  g.stroke()
  // 鳥首雞冠（鋸齒冠羽）
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(cx - 30, 96)
  g.lineTo(cx - 14, 56)
  g.lineTo(cx, 88)
  g.lineTo(cx + 14, 44)
  g.lineTo(cx + 30, 92)
  g.stroke()
  // 眼
  g.beginPath()
  g.arc(cx, 132, 7, 0, Math.PI * 2)
  g.stroke()
  // 雷紋雙翼
  const wing = (dir: number) => {
    g.beginPath()
    g.moveTo(cx + dir * 66, 180)
    g.lineTo(cx + dir * 150, 140)
    g.lineTo(cx + dir * 128, 196)
    g.lineTo(cx + dir * 210, 176)
    g.lineTo(cx + dir * 168, 244)
    g.lineTo(cx + dir * 226, 250)
    g.lineTo(cx + dir * 130, 300)
    g.lineTo(cx + dir * 88, 268)
    g.stroke()
  }
  wing(1)
  wing(-1)
  // 底部尾羽
  g.beginPath()
  g.moveTo(cx - 26, 392)
  g.lineTo(cx, 460)
  g.lineTo(cx + 26, 392)
  g.stroke()
  // 微光暈填充
  g.shadowBlur = 0
  g.fillStyle = 'rgba(255, 190, 90, 0.07)'
  g.beginPath()
  g.moveTo(cx, 90)
  g.quadraticCurveTo(cx + 92, 210, cx, 400)
  g.quadraticCurveTo(cx - 92, 210, cx, 90)
  g.closePath()
  g.fill()

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function Gen7Guardian() {
  const tex = useMemo(() => gen7MakeGuardianTex(), [])
  const grp = useRef<Group>(null)
  const mat = useRef<MeshBasicMaterial>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (grp.current) {
      grp.current.position.y = 17 + Math.sin(t * 0.5) * 1.4
      // 偏離中線盤旋，避開 HUD 橫幅遮擋
      grp.current.position.x = -26 + Math.sin(t * 0.21) * 6
      const s = 1 + 0.04 * Math.sin(t * 1.4)
      grp.current.scale.set(s, s, 1)
    }
    if (mat.current) mat.current.opacity = 0.6 + 0.24 * Math.sin(t * 1.4)
  })

  return (
    <group ref={grp} position={[-26, 17, -80]}>
      <mesh>
        <planeGeometry args={[22, 22]} />
        <meshBasicMaterial
          ref={mat}
          map={tex}
          color={[1.9, 1.4, 0.6]}
          transparent
          opacity={0.7}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </group>
  )
}

/* ---------- 主組件：布景 ---------- */

export default function Gen7Manalo() {
  return (
    <>
      <Gen7Sky />
      <Environment files="/assets/hdri/venice_sunset_2k.hdr" environmentIntensity={0.55} />

      {/* 低角度黃金落日主光（唯一投影光源 → 長影） */}
      <directionalLight
        position={[-30, 11, -36]}
        intensity={2.1}
        color="#ffb46a"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
      />
      {/* 逆光金邊補光 */}
      <directionalLight position={[26, 9, 30]} intensity={0.5} color="#ffd9a8" />
      <hemisphereLight args={['#ffc890', '#6a4a3c', 0.6]} />
      <ambientLight intensity={0.14} color="#ffcf9a" />

      <Gen7Ocean />
      <Gen7Stands />
      <Crowd tiers={G7_TIERS} style="modern" brightness={[0.95, 1.2]} />
      <Gen7Festival />
      <Gen7Torches />
      <Gen7Guardian />
    </>
  )
}

/* ---------- 戰鬥地板：沙白場 + 波紋圈 + 花朵徽章 ---------- */

function gen7MakeCourtTex(): CanvasTexture {
  const W = 1600
  const H = 960
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const r = gen7Rng(771)

  // 沙白底
  g.fillStyle = '#eee2c4'
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 80; i++) {
    g.fillStyle = i % 2 ? 'rgba(226, 208, 172, 0.4)' : 'rgba(248, 240, 220, 0.5)'
    g.beginPath()
    g.ellipse(r() * W, r() * H, 40 + r() * 120, 24 + r() * 70, r() * Math.PI, 0, Math.PI * 2)
    g.fill()
  }
  // 沙粒
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(180, 150, 110, 0.25)' : 'rgba(255, 250, 240, 0.3)'
    g.fillRect(r() * W, r() * H, 2 + r() * 2, 2 + r() * 2)
  }

  const cx = W / 2
  const cy = H / 2

  // 波紋圈（青綠貝殼弧環，兩圈）
  const wavyRing = (rad: number, lw: number, alpha: number) => {
    g.strokeStyle = `rgba(32, 148, 152, ${alpha})`
    g.lineWidth = lw
    g.beginPath()
    for (let i = 0; i <= 140; i++) {
      const a = (i / 140) * Math.PI * 2
      const rr = rad + Math.sin(a * 9) * 9
      const x = cx + Math.cos(a) * rr * 1.28
      const y = cy + Math.sin(a) * rr
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
    g.stroke()
  }
  wavyRing(300, 9, 0.75)
  wavyRing(240, 6, 0.55)

  // 中央扶桑花徽章
  const petal = (ang: number) => {
    g.save()
    g.translate(cx, cy)
    g.rotate(ang)
    g.beginPath()
    g.moveTo(0, 0)
    g.bezierCurveTo(-52, -46, -44, -132, 0, -148)
    g.bezierCurveTo(44, -132, 52, -46, 0, 0)
    g.closePath()
    g.fillStyle = 'rgba(240, 90, 110, 0.85)'
    g.fill()
    g.strokeStyle = 'rgba(200, 50, 76, 0.9)'
    g.lineWidth = 4
    g.stroke()
    g.restore()
  }
  for (let i = 0; i < 5; i++) petal((i / 5) * Math.PI * 2)
  g.fillStyle = 'rgba(255, 209, 102, 0.95)'
  g.beginPath()
  g.arc(cx, cy, 34, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(216, 150, 40, 0.9)'
  g.lineWidth = 4
  g.beginPath()
  g.arc(cx, cy, 34, 0, Math.PI * 2)
  g.stroke()

  // 邊界線
  const M = 60
  g.strokeStyle = 'rgba(250, 250, 245, 0.92)'
  g.lineWidth = 8
  g.strokeRect(M, M, W - M * 2, H - M * 2)
  g.beginPath()
  g.moveTo(W / 2, M)
  g.lineTo(W / 2, H - M)
  g.stroke()

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function Gen7ManaloFloor(_props: { fieldType?: FieldType | null }) {
  const tex = useMemo(() => gen7MakeCourtTex(), [])
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* 碰撞體不變：40×24 頂面 y=0 + 四面隱形擋牆 */}
      <CuboidCollider args={[20, 0.25, 12]} position={[0, -0.25, 0]} />
      <CuboidCollider args={[0.3, 2, 12.6]} position={[20.9, 1.5, 0]} />
      <CuboidCollider args={[0.3, 2, 12.6]} position={[-20.9, 1.5, 0]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, 12.9]} />
      <CuboidCollider args={[21.2, 2, 0.3]} position={[0, 1.5, -12.9]} />

      {/* 基座 */}
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[40, 0.5, 24]} />
        <meshStandardMaterial color="#c8b48e" roughness={1} />
      </mesh>
      {/* 沙白場面 */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial map={tex} roughness={0.88} metalness={0} envMapIntensity={0.45} />
      </mesh>
      {/* 場外白色甲板（純視覺；橢圓貼合場館船體輪廓） */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} scale={[1, 0.81, 1]}>
        <circleGeometry args={[41.4, 48]} />
        <meshStandardMaterial color="#ddd2ba" roughness={0.9} />
      </mesh>
    </RigidBody>
  )
}
