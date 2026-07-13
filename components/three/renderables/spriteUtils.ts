'use client'
import {
  Camera,
  CanvasTexture,
  DoubleSide,
  Euler,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  Quaternion,
  SRGBColorSpace,
  Texture,
  Vector3,
} from 'three'
import { battleWorld } from '@/stores/battleWorld'

/* ---------- 受擊白閃材質 ---------- */

/**
 * Sprite 專用材質：MeshBasicMaterial（不受光 → 復古全亮）+ onBeforeCompile
 * 注入 uFlash，把最終輸出 lerp 到純白（basic material 的 color 只能乘暗、乘不白）。
 */
export function makeSpriteMaterial(map: Texture, uFlash: { value: number }): MeshBasicMaterial {
  const mat = new MeshBasicMaterial({
    map,
    transparent: true,
    alphaTest: 0.35,
    side: DoubleSide,
    toneMapped: false,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFlash = uFlash
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform vec3 diffuse;', 'uniform vec3 diffuse;\nuniform float uFlash;')
      .replace(
        '#include <opaque_fragment>',
        'outgoingLight = mix(outgoingLight, vec3(1.0), uFlash);\n#include <opaque_fragment>',
      )
  }
  mat.customProgramCacheKey = () => 'sprite-flash'
  return mat
}

/** 每幀讀 battleWorld 的白閃截止時間 → uFlash 值（0.85 留一絲輪廓層次） */
export function flashValueFor(entity?: 'player' | 'enemy'): number {
  if (!entity) return 0
  const until = entity === 'player' ? battleWorld.playerFlashUntil : battleWorld.enemyFlashUntil
  return performance.now() < until ? 0.85 : 0
}

/* ---------- Y 軸看板（billboard） ---------- */

const wp = new Vector3()
const pq = new Quaternion()
const pe = new Euler()

/**
 * 讓 group 的 +Z 面朝相機（僅繞 Y）。以「世界角 − 父層世界 Y 旋轉」設定本地
 * rotation.y，因此可與父層變換（面向旋轉、KO 側倒 rotation.z）正確組合。
 */
export function faceCameraYaw(group: Object3D, camera: Camera) {
  group.getWorldPosition(wp)
  const angle = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z)
  if (group.parent) {
    group.parent.getWorldQuaternion(pq)
    pe.setFromQuaternion(pq, 'YXZ')
    group.rotation.y = angle - pe.y
  } else {
    group.rotation.y = angle
  }
}

/* ---------- 圓形假陰影貼圖 ---------- */

let blobTex: CanvasTexture | null = null

/** 柔邊圓形漸層（黑 → 透明），供 sprite 模式的地面假陰影使用。 */
export function blobShadowTexture(): CanvasTexture {
  if (blobTex) return blobTex
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.85)')
  g.addColorStop(0.6, 'rgba(0,0,0,0.55)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  blobTex = new CanvasTexture(canvas)
  blobTex.colorSpace = SRGBColorSpace
  return blobTex
}

/* ---------- 貼圖設定 ---------- */

/** 點陣：NearestFilter、關 mipmap（putpixel 級銳利）；官繪 fallback 用 Linear。 */
export function configureSpriteTexture(tex: Texture, pixelated: boolean) {
  tex.colorSpace = SRGBColorSpace
  if (pixelated) {
    tex.magFilter = NearestFilter
    tex.minFilter = NearestFilter
    tex.generateMipmaps = false
  }
  return tex
}
