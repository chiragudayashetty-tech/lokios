'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Stylised low-poly island (Three.js). Everything on it comes from `world` (buildWorld).
// The base island (terrain, water, sky) is built once; objects are rebuilt when `world` changes,
// from shared geometries/materials so a timelapse can redraw ~10×/s.

const R = 10 // island radius in world units at size 1
const SEA = 0 // water level

// ── noise ─────────────────────────────────────────────────────────────
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s) }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3) * 0.17
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

// Mountain sits at the back so it never hides the village from the default camera.
const MOUNT = { x: -2.2, z: -6.2 }

/** Height of the island at (x, z) in unit-size coordinates. */
export function heightAt(x, z) {
  const r = Math.hypot(x, z) / R
  const ang = Math.atan2(z, x)
  const coast = 0.93 + (fbm(Math.cos(ang) * 1.7 + 3, Math.sin(ang) * 1.7 + 3) - 0.5) * 0.28 // wobbly coastline
  const land = 1 - smooth(coast - 0.2, coast, r)
  if (land <= 0) return -1.2 + (1 - smooth(coast, coast + 0.35, r)) * 1.1 // sea floor rising to the beach
  // plateau with soft terraces (Clash-style cliffs)
  let h = 0.12 + land * 0.55
  const hills = fbm(x * 0.16 + 7, z * 0.16 + 2)
  h += smooth(0.5, 0.85, hills) * 0.9 * land
  const step = 0.45
  const q = Math.floor(h / step) * step
  h = q + smooth(0.72, 1, (h - q) / step) * step
  // mountain
  const dm = Math.hypot(x - MOUNT.x, z - MOUNT.z)
  h += Math.max(0, 1 - dm / 4.2) ** 1.6 * 4.6 * land
  return h
}

function colorFor(h, x, z, slope) {
  const n = vnoise(x * 0.9, z * 0.9)
  if (h < 0.02) return new THREE.Color('#d9c48e').lerp(new THREE.Color('#1f6f86'), Math.min(1, -h * 0.9))
  if (h < 0.28) return new THREE.Color('#ead8a3').lerp(new THREE.Color('#dcc58a'), n)
  if (slope > 0.55 && h > 0.5) return new THREE.Color('#8b7a68').lerp(new THREE.Color('#6f6155'), n) // cliff faces
  if (h > 3.7) return new THREE.Color('#f3f6fb')
  if (h > 2.4) return new THREE.Color('#8d8a86').lerp(new THREE.Color('#a8a29a'), n)
  return new THREE.Color('#5fb84a').lerp(new THREE.Color('#3f9a3e'), n * 0.9).lerp(new THREE.Color('#7cc75a'), smooth(0.7, 1, vnoise(x * 0.3 + 9, z * 0.3)))
}

function buildTerrain() {
  const geo = new THREE.CircleGeometry(R * 1.32, 96, 0, Math.PI * 2)
  // densify: CircleGeometry is a fan; use a polar grid instead for nicer facets
  const rings = 44, segs = 120
  const pos = []
  const idx = []
  pos.push(0, 0, 0)
  for (let i = 1; i <= rings; i++) {
    const rr = (i / rings) ** 0.9 * R * 1.32
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2 + (i % 2) * (Math.PI / segs)
      pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr)
    }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j)
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segs, b0 = 1 + i * segs
    for (let j = 0; j < segs; j++) {
      const a = a0 + j, a1 = a0 + ((j + 1) % segs), b = b0 + j, b1 = b0 + ((j + 1) % segs)
      idx.push(a, a1, b, a1, b1, b)
    }
  }
  geo.dispose()
  let g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  const p = g.attributes.position
  for (let k = 0; k < p.count; k++) p.setY(k, heightAt(p.getX(k), p.getZ(k)))
  g = g.toNonIndexed() // flat-shaded facets
  g.computeVertexNormals()
  const colors = []
  const P = g.attributes.position, N = g.attributes.normal
  for (let k = 0; k < P.count; k += 3) {
    const cx = (P.getX(k) + P.getX(k + 1) + P.getX(k + 2)) / 3
    const cy = (P.getY(k) + P.getY(k + 1) + P.getY(k + 2)) / 3
    const cz = (P.getZ(k) + P.getZ(k + 1) + P.getZ(k + 2)) / 3
    const c = colorFor(cy, cx, cz, 1 - N.getY(k))
    for (let t = 0; t < 3; t++) colors.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }))
  mesh.receiveShadow = true
  return mesh
}

// Waterfall + river from the mountain down to the sea
function buildWaterfall() {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: '#7fd8ff', emissive: '#3aa8d8', emissiveIntensity: 0.25, transparent: true, opacity: 0.85, roughness: 0.2 })
  const top = { x: MOUNT.x + 2.1, z: MOUNT.z + 1.6 }
  const h = heightAt(top.x, top.z)
  const fall = new THREE.Mesh(new THREE.BoxGeometry(0.5, Math.max(0.5, h - 0.3), 0.12), mat)
  fall.position.set(top.x + 0.25, (h + 0.3) / 2, top.z + 0.35)
  fall.userData.flow = true
  g.add(fall)
  const mist = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 }))
  mist.position.set(top.x + 0.25, 0.45, top.z + 0.5)
  mist.userData.mist = true
  g.add(mist)
  return g
}

function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 }, uCoast: { value: R * 0.95 },
      uDeep: { value: new THREE.Color('#0b5a8f') }, uShallow: { value: new THREE.Color('#33d1c9') },
      uFoam: { value: new THREE.Color('#ffffff') }, uDim: { value: 1 },
    },
    vertexShader: `
      uniform float uTime; varying vec3 vPos;
      void main() {
        vec3 p = position;
        p.z += sin(p.x * 0.35 + uTime * 1.2) * 0.06 + cos(p.y * 0.3 + uTime * 0.9) * 0.06;
        vPos = (modelMatrix * vec4(p, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uCoast; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform float uDim;
      varying vec3 vPos;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main() {
        float r = length(vPos.xz);
        float ang = atan(vPos.z, vPos.x);
        float wob = (n(vec2(cos(ang)*1.7+3.0, sin(ang)*1.7+3.0)) - 0.5) * 0.28;
        float coast = uCoast * (1.0 + wob);
        float d = r - coast;
        float shallow = 1.0 - smoothstep(0.0, 5.5, d);
        vec3 col = mix(uDeep, uShallow, shallow * 0.9);
        float ripple = n(vPos.xz * 0.9 + vec2(uTime * 0.25, uTime * 0.18)) * n(vPos.xz * 1.7 - uTime * 0.2);
        col += ripple * 0.12;
        float foam = smoothstep(1.2, 0.0, abs(d - 0.5 - sin(uTime * 1.5 + ang * 6.0) * 0.25)) * (0.55 + 0.45 * n(vPos.xz * 3.0 + uTime));
        col = mix(col, uFoam, clamp(foam, 0.0, 1.0) * 0.85);
        float spark = pow(n(vPos.xz * 2.5 + uTime * 0.6), 18.0) * 1.6;
        col += spark;
        float edge = smoothstep(70.0, 40.0, r);
        gl_FragColor = vec4(col * uDim, 0.96 * edge + 0.04);
      }`,
  })
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color('#5fb4f0') }, uBottom: { value: new THREE.Color('#d8f0ff') } },
    vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uBottom; varying vec3 vW; void main(){ float t = smoothstep(-0.05, 0.6, vW.y); gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0); }',
  })
}

// ── shared object kit ─────────────────────────────────────────────────
function makeKit() {
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra })
  return {
    mat: {
      trunk: std('#8a5a35'), palmTrunk: std('#a77a4a'), stump: std('#7a5230'),
      leaf: ['#3fae5a', '#2f9e6e', '#4cb85a', '#2e8b57', '#57c27a'].map((c) => std(c)),
      dry: std('#c98b3b'), bloomA: std('#ff8fb1', { emissive: '#ff8fb1', emissiveIntensity: 0.15 }), bloomB: std('#ffd166', { emissive: '#ffd166', emissiveIntensity: 0.15 }),
      wall: std('#f3e6c8'), wood: std('#8a5a3a'), plank: std('#a8794c'), rock: std('#8f8a84'), rockDark: std('#6c6762'),
      roofs: ['#d9534f', '#3987e5', '#e58e26', '#8b6fd6', '#d55181', '#199e70'].map((c) => std(c)),
      window: std('#2b3a55'), windowLit: new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ffb84d', emissiveIntensity: 1.4 }),
      stone: std('#e6e1d6'), stoneDark: std('#bdb5a6'), scaffold: std('#e0a030'), scaffoldLate: std('#e5484d'),
      flag: new THREE.MeshStandardMaterial({ color: '#ffd166', side: THREE.DoubleSide, flatShading: true }),
      crystal: new THREE.MeshStandardMaterial({ color: '#7fd3ff', emissive: '#38a8ff', emissiveIntensity: 1.1, flatShading: true, transparent: true, opacity: 0.92 }),
      sail: std('#f7f3ea', { side: THREE.DoubleSide }), hull: std('#7a4b2a'), gull: std('#ffffff'),
      pick: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }),
    },
    geo: {
      trunk: new THREE.CylinderGeometry(0.07, 0.11, 1, 6),
      crown: new THREE.IcosahedronGeometry(0.5, 0),
      cone: new THREE.ConeGeometry(0.5, 1, 7),
      frond: new THREE.ConeGeometry(0.12, 1.1, 4),
      stump: new THREE.CylinderGeometry(0.14, 0.16, 0.18, 7),
      ball: new THREE.IcosahedronGeometry(0.06, 0),
      box: new THREE.BoxGeometry(1, 1, 1),
      roof: new THREE.ConeGeometry(0.78, 0.55, 4),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      crystal: new THREE.OctahedronGeometry(0.28, 0),
      flag: new THREE.PlaneGeometry(0.5, 0.3, 6, 1),
      ring: new THREE.RingGeometry(0.6, 0.78, 28),
      rock: new THREE.DodecahedronGeometry(0.3, 0),
    },
  }
}

const mesh = (geo, mat, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0, rz = 0, rx = 0 } = {}) => {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz)
  m.castShadow = true; m.receiveShadow = true
  return m
}

const STAGE_SCALE = [0.35, 0.55, 0.75, 1, 1.3, 1.65]

function makeTree(kit, t) {
  const g = new THREE.Group()
  if (t.stump) { g.add(mesh(kit.geo.stump, kit.mat.stump, { y: 0.09 })); return g }
  const k = STAGE_SCALE[t.stage]
  const leafMat = t.dry ? kit.mat.dry : kit.mat.leaf[Math.floor(t.seed * kit.mat.leaf.length)]
  const palm = t.seed > 0.55 // a mix of palms and broadleaf trees
  if (t.stage === 0) {
    g.add(mesh(kit.geo.cone, leafMat, { y: 0.1, sx: 0.12, sy: 0.22, sz: 0.12 }))
    return g
  }
  if (palm) {
    const h = 1.7 * k
    const lean = (t.seed - 0.75) * 0.6
    for (let i = 0; i < 4; i++) g.add(mesh(kit.geo.trunk, kit.mat.palmTrunk, { x: Math.sin(lean) * h * (i / 4 + 0.12), y: (h / 4) * (i + 0.5), sx: k * (1 - i * 0.08), sy: h / 4, sz: k * (1 - i * 0.08), rz: -lean * 0.6 }))
    const top = new THREE.Group()
    top.position.set(Math.sin(lean) * h, h, 0)
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      top.add(mesh(kit.geo.frond, leafMat, { x: Math.cos(a) * 0.38 * k, z: Math.sin(a) * 0.38 * k, y: -0.05 * k, sx: k * 1.6, sy: k, sz: k * 0.5, rz: Math.PI / 2 - 0.35, ry: -a }))
    }
    top.add(mesh(kit.geo.ball, kit.mat.trunk, { y: -0.08, sx: k * 1.4, sy: k * 1.4, sz: k * 1.4 }))
    g.add(top)
    g.userData.sway = top
  } else {
    const h = 0.9 * k
    g.add(mesh(kit.geo.trunk, kit.mat.trunk, { y: h / 2, sx: k * 1.4, sy: h, sz: k * 1.4 }))
    const crown = new THREE.Group()
    crown.position.y = h
    crown.add(mesh(kit.geo.crown, leafMat, { y: 0.45 * k, sx: 1.25 * k, sy: 1.1 * k, sz: 1.25 * k, ry: t.seed * 3 }))
    crown.add(mesh(kit.geo.crown, leafMat, { x: 0.32 * k, y: 0.25 * k, sx: 0.8 * k, sy: 0.75 * k, sz: 0.8 * k, ry: t.seed * 5 }))
    if (t.stage >= 4) crown.add(mesh(kit.geo.crown, leafMat, { x: -0.35 * k, y: 0.85 * k, sx: 0.85 * k, sy: 0.8 * k, sz: 0.85 * k }))
    g.add(crown)
    g.userData.sway = crown
    if (t.bloom && !t.dry) {
      for (let i = 0; i < 3 + Math.min(4, t.stage); i++) {
        const a = i * 2.1 + t.seed * 6
        crown.add(mesh(kit.geo.ball, i % 2 ? kit.mat.bloomA : kit.mat.bloomB, { x: Math.cos(a) * 0.55 * k, y: 0.45 * k + Math.sin(i * 1.3) * 0.35 * k, z: Math.sin(a) * 0.55 * k, sx: 1.4, sy: 1.4, sz: 1.4 }))
      }
    }
  }
  return g
}

function makeHouse(kit, h, night) {
  const g = new THREE.Group()
  const roof = kit.mat.roofs[Math.floor(h.seed * kit.mat.roofs.length)]
  g.add(mesh(kit.geo.box, kit.mat.wall, { y: 0.32, sx: 0.85, sy: 0.64, sz: 0.75 }))
  g.add(mesh(kit.geo.roof, roof, { y: 0.9, ry: Math.PI / 4, sx: 0.85, sz: 0.85 }))
  g.add(mesh(kit.geo.box, kit.mat.wood, { y: 0.17, z: 0.38, sx: 0.2, sy: 0.34, sz: 0.02 }))
  g.add(mesh(kit.geo.box, night ? kit.mat.windowLit : kit.mat.window, { x: 0.24, y: 0.4, z: 0.38, sx: 0.16, sy: 0.14, sz: 0.02 }))
  g.add(mesh(kit.geo.box, kit.mat.stoneDark, { x: -0.22, y: 1.0, z: -0.1, sx: 0.12, sy: 0.3, sz: 0.12 }))
  return g
}

function makeLandmark(kit, l) {
  const g = new THREE.Group()
  if (l.kind === 'landmark') {
    g.add(mesh(kit.geo.cyl, kit.mat.stoneDark, { y: 0.12, sx: 1.5, sy: 0.24, sz: 1.5 }))
    g.add(mesh(kit.geo.cyl, kit.mat.stone, { y: 1.0, sx: 0.85, sy: 1.8, sz: 0.85 }))
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(mesh(kit.geo.box, kit.mat.stone, { x: Math.cos(a) * 0.4, z: Math.sin(a) * 0.4, y: 2.0, sx: 0.16, sy: 0.22, sz: 0.16 })) }
    g.add(mesh(kit.geo.box, kit.mat.window, { y: 1.2, z: 0.43, sx: 0.14, sy: 0.3, sz: 0.02 }))
    const crystal = mesh(kit.geo.crystal, kit.mat.crystal, { y: 2.55, sy: 1.5 })
    crystal.userData.spin = true
    g.add(crystal)
    g.add(mesh(kit.geo.box, kit.mat.wood, { x: 0.3, y: 2.55, sx: 0.03, sy: 0.9, sz: 0.03 }))
    const flag = mesh(kit.geo.flag, kit.mat.flag, { x: 0.56, y: 2.85 })
    flag.userData.flag = true
    g.add(flag)
  } else if (l.kind === 'ruin') {
    g.add(mesh(kit.geo.cyl, kit.mat.rock, { y: 0.25, sx: 0.85, sy: 0.5, sz: 0.85 }))
    g.add(mesh(kit.geo.box, kit.mat.rock, { x: 0.25, y: 0.65, sx: 0.25, sy: 0.4, sz: 0.25, rz: 0.3 }))
    g.add(mesh(kit.geo.rock, kit.mat.rockDark, { x: -0.6, y: 0.15, z: 0.3 }))
    g.add(mesh(kit.geo.rock, kit.mat.rockDark, { x: 0.5, y: 0.12, z: 0.5, sx: 0.7, sy: 0.7, sz: 0.7 }))
  } else {
    const built = Math.max(0.15, (l.progress / 100) * 1.8)
    const sc = l.late ? kit.mat.scaffoldLate : kit.mat.scaffold
    g.add(mesh(kit.geo.cyl, kit.mat.stoneDark, { y: 0.1, sx: 1.4, sy: 0.2, sz: 1.4 }))
    g.add(mesh(kit.geo.cyl, kit.mat.stone, { y: 0.2 + built / 2, sx: 0.8, sy: built, sz: 0.8 }))
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) g.add(mesh(kit.geo.box, sc, { x, z, y: 1.1, sx: 0.05, sy: 2.2, sz: 0.05 }))
    for (let i = 1; i <= 3; i++) { g.add(mesh(kit.geo.box, sc, { y: i * 0.6, z: 0.5, sx: 1.05, sy: 0.04, sz: 0.04 })); g.add(mesh(kit.geo.box, sc, { y: i * 0.6, x: 0.5, sx: 0.04, sy: 0.04, sz: 1.05 })) }
    // crane
    const crane = new THREE.Group()
    crane.position.set(0.95, 0, -0.2)
    crane.add(mesh(kit.geo.box, kit.mat.scaffold, { y: 1.5, sx: 0.08, sy: 3, sz: 0.08 }))
    const arm = new THREE.Group(); arm.position.y = 3
    arm.add(mesh(kit.geo.box, kit.mat.scaffold, { x: -0.55, sx: 1.6, sy: 0.07, sz: 0.07 }))
    arm.add(mesh(kit.geo.box, kit.mat.wood, { x: -1.1, y: -0.35, sx: 0.02, sy: 0.7, sz: 0.02 }))
    arm.add(mesh(kit.geo.box, kit.mat.stoneDark, { x: 0.35, y: -0.08, sx: 0.25, sy: 0.18, sz: 0.2 }))
    crane.add(arm)
    arm.userData.crane = true
    g.add(crane)
  }
  return g
}

function makeShip(kit) {
  const g = new THREE.Group()
  g.add(mesh(kit.geo.box, kit.mat.hull, { y: 0.12, sx: 1.4, sy: 0.3, sz: 0.5 }))
  g.add(mesh(kit.geo.cone, kit.mat.hull, { x: 0.82, y: 0.12, rz: -Math.PI / 2, sx: 0.5, sy: 0.4, sz: 0.5 }))
  g.add(mesh(kit.geo.box, kit.mat.wood, { y: 0.85, sx: 0.05, sy: 1.3, sz: 0.05 }))
  const sail = mesh(kit.geo.box, kit.mat.sail, { y: 0.9, x: 0.05, sx: 0.04, sy: 0.9, sz: 0.75 })
  g.add(sail)
  g.add(mesh(kit.geo.flag, kit.mat.flag, { y: 1.55, x: 0.2, sx: 0.5, sy: 0.5 }))
  return g
}

function makeDock(kit) {
  const g = new THREE.Group()
  for (let i = 0; i < 6; i++) g.add(mesh(kit.geo.box, kit.mat.plank, { x: i * 0.32, y: 0.12, sx: 0.28, sy: 0.05, sz: 0.6 }))
  for (const x of [0.2, 0.9, 1.6]) for (const z of [-0.26, 0.26]) g.add(mesh(kit.geo.box, kit.mat.wood, { x, y: 0, z, sx: 0.06, sy: 0.4, sz: 0.06 }))
  return g
}

function makeCloud(dark) {
  const g = new THREE.Group()
  const m = new THREE.MeshStandardMaterial({ color: dark ? '#8e98a8' : '#ffffff', flatShading: true, roughness: 1, transparent: true, opacity: 0.95 })
  const s = new THREE.IcosahedronGeometry(1, 0)
  for (const [x, y, k] of [[0, 0, 1], [1.1, -0.2, 0.75], [-1, -0.25, 0.7], [0.4, 0.35, 0.7]]) { const c = new THREE.Mesh(s, m); c.position.set(x, y, 0); c.scale.setScalar(k); c.castShadow = true; g.add(c) }
  return g
}

const PALETTES = {
  day: { top: '#4fa9ef', bottom: '#cfeeff', sun: '#fff4e0', sunI: 2.6, hemiSky: '#cfe8ff', hemiGround: '#5b8a4a', hemiI: 1.1, fog: '#bfe3f7', dim: 1 },
  dusk: { top: '#4a5aa8', bottom: '#ffb37a', sun: '#ffb070', sunI: 1.8, hemiSky: '#ffcba4', hemiGround: '#4a5a3a', hemiI: 0.9, fog: '#f2b48c', dim: 0.85 },
  night: { top: '#070d24', bottom: '#1d2b55', sun: '#9fb4ff', sunI: 0.55, hemiSky: '#3a4a80', hemiGround: '#14203a', hemiI: 0.45, fog: '#16213f', dim: 0.4 },
  rain: { top: '#56657a', bottom: '#9aa7b8', sun: '#dfe6ef', sunI: 1.1, hemiSky: '#b8c4d4', hemiGround: '#4a5a4a', hemiI: 0.9, fog: '#8c99aa', dim: 0.7 },
}

/**
 * The 3D island. Props: world (from buildWorld), onPick(obj), picked (id),
 * compact (no controls, slow spin — for small previews).
 */
export default function Island3D({ world, onPick, picked, compact = false, className = '' }) {
  const hostRef = useRef(null)
  const api = useRef(null)
  const pickRef = useRef(onPick)
  useEffect(() => { pickRef.current = onPick }, [onPick])

  // ── one-time scene ──
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch { host.dataset.nogl = '1'; return }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog('#bfe3f7', 40, 90)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400)
    camera.position.set(17, 15, 21)

    const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), skyMaterial())
    scene.add(sky)
    const hemi = new THREE.HemisphereLight('#cfe8ff', '#5b8a4a', 1.1)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight('#fff4e0', 2.6)
    sun.position.set(14, 22, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(compact ? 1024 : 2048, compact ? 1024 : 2048)
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 })
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.03
    scene.add(sun)

    const water = new THREE.Mesh(new THREE.PlaneGeometry(150, 150, 120, 120), waterMaterial())
    water.rotation.x = -Math.PI / 2
    water.position.y = SEA + 0.02
    scene.add(water)

    const island = new THREE.Group()
    island.add(buildTerrain())
    island.add(buildWaterfall())
    scene.add(island)

    // night sky
    const starGeo = new THREE.BufferGeometry()
    const sp = []
    for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.2, r = 160; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r) }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.1, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false }))
    scene.add(stars)
    const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 14), new THREE.MeshBasicMaterial({ color: '#f4f1de', fog: false }))
    moon.position.set(-60, 70, -110)
    scene.add(moon)

    // rain
    const rainN = 1400
    const rainGeo = new THREE.BufferGeometry()
    const rp = new Float32Array(rainN * 6)
    for (let i = 0; i < rainN; i++) { const x = (Math.random() - 0.5) * 50, y = Math.random() * 30, z = (Math.random() - 0.5) * 50; rp.set([x, y, z, x + 0.05, y - 0.7, z], i * 6) }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3))
    const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0.55 }))
    scene.add(rain)

    const clouds = new THREE.Group()
    scene.add(clouds)
    const kit = makeKit()

    // ship + dock + gulls (always present, life on the island)
    const dock = makeDock(kit)
    dock.position.set(6.9, 0, 6.2); dock.rotation.y = -0.75
    island.add(dock)
    const ship = makeShip(kit)
    scene.add(ship)
    const gulls = new THREE.Group()
    for (let i = 0; i < 4; i++) {
      const gg = new THREE.Group()
      gg.add(mesh(kit.geo.box, kit.mat.gull, { x: -0.18, rz: 0.4, sx: 0.36, sy: 0.03, sz: 0.1 }))
      gg.add(mesh(kit.geo.box, kit.mat.gull, { x: 0.18, rz: -0.4, sx: 0.36, sy: 0.03, sz: 0.1 }))
      gg.userData = { r: 6 + i * 2.5, h: 6 + i * 0.8, s: 0.25 + i * 0.07, o: i * 1.7 }
      gulls.add(gg)
    }
    scene.add(gulls)

    const objects = new THREE.Group()
    island.add(objects)
    const boats = new THREE.Group()
    scene.add(boats)
    const marker = new THREE.Mesh(kit.geo.ring, kit.mat.pick)
    marker.rotation.x = -Math.PI / 2
    marker.visible = false
    scene.add(marker)

    let controls = null
    if (!compact) {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.minDistance = 12
      controls.maxDistance = 48
      controls.maxPolarAngle = Math.PI * 0.44
      controls.minPolarAngle = Math.PI * 0.12
      controls.enablePan = false
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.35
      controls.target.set(0, 1, 0)
      controls.addEventListener('start', () => { controls.autoRotate = false })
    } else {
      camera.position.set(16, 13, 19)
      camera.lookAt(0, 0.5, 0)
    }

    // picking
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let downAt = null
    const onDown = (e) => { downAt = { x: e.clientX, y: e.clientY } }
    const onUp = (e) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const hit = ray.intersectObjects(objects.children, true)[0]
      let o = hit?.object
      while (o && !o.userData.obj) o = o.parent
      pickRef.current?.(o ? o.userData.obj : null)
    }
    if (!compact) { renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp) }

    const resize = () => {
      const w = host.clientWidth || 300
      const h = host.clientHeight || 200
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      // keep the whole island in frame on narrow screens
      camera.fov = w / h < 1 ? 52 : 38
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting })
    io.observe(host)

    const clock = new THREE.Clock()
    let raf
    const state = { rain: false, size: 1 }
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible || document.hidden) return
      const t = clock.getElapsedTime()
      water.material.uniforms.uTime.value = t
      objects.traverse((o) => {
        if (o.userData.sway) o.userData.sway.rotation.z = Math.sin(t * 1.3 + o.position.x) * 0.05
        if (o.userData.spin) { o.rotation.y = t * 0.8; o.position.y = 2.55 + Math.sin(t * 2) * 0.08 }
        if (o.userData.flag) o.scale.x = 0.85 + Math.sin(t * 6 + o.position.y) * 0.15
        if (o.userData.crane) o.rotation.y = Math.sin(t * 0.4) * 1.1
      })
      island.traverse((o) => { if (o.userData.mist) o.scale.setScalar(1 + Math.sin(t * 3) * 0.12) })
      // ship sails around the island
      const sr = R * state.size + 5.5
      const sa = t * 0.07
      ship.position.set(Math.cos(sa) * sr, Math.sin(t * 1.4) * 0.05, Math.sin(sa) * sr)
      ship.rotation.set(Math.sin(t * 1.1) * 0.04, -sa - Math.PI / 2, Math.sin(t * 0.9) * 0.05)
      boats.children.forEach((b, i) => { const a = b.userData.a + t * 0.04 * (i % 2 ? 1 : -1); const r = R * state.size + 3.2 + i * 0.6; b.position.set(Math.cos(a) * r, Math.sin(t * 1.6 + i) * 0.04, Math.sin(a) * r); b.rotation.y = -a + (i % 2 ? -Math.PI / 2 : Math.PI / 2) })
      gulls.children.forEach((g) => { const { r, h, s, o } = g.userData; const a = t * s + o; g.position.set(Math.cos(a) * r, h + Math.sin(t * 2 + o) * 0.3, Math.sin(a) * r); g.rotation.y = -a; g.children[0].rotation.z = 0.4 + Math.sin(t * 8 + o) * 0.35; g.children[1].rotation.z = -g.children[0].rotation.z })
      clouds.children.forEach((c, i) => { c.position.x += 0.01 * (1 + i * 0.2); if (c.position.x > 40) c.position.x = -40 })
      if (state.rain) {
        const a = rain.geometry.attributes.position
        for (let i = 0; i < a.count; i += 2) { let y = a.getY(i) - 0.5; if (y < 0) y += 30; a.setY(i, y); a.setY(i + 1, y - 0.7) }
        a.needsUpdate = true
      }
      if (compact) { const a = t * 0.08; camera.position.set(Math.cos(a) * 25, 13, Math.sin(a) * 25); camera.lookAt(0, 0.6, 0) }
      controls?.update()
      renderer.render(scene, camera)
    }
    tick()

    api.current = { scene, island, objects, boats, kit, sun, hemi, sky, water, stars, moon, rain, clouds, marker, state, camera, controls, renderer }
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect(); io.disconnect()
      controls?.dispose()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m?.dispose?.() })
      renderer.dispose()
      renderer.domElement.remove()
      api.current = null
    }
  }, [compact])

  // ── world → scene ──
  useEffect(() => {
    const a = api.current
    if (!a || !world) return
    const { island, objects, boats, kit, sun, hemi, sky, water, stars, moon, rain, clouds, scene, state } = a
    const size = Math.max(0.6, world.size)
    state.size = size
    island.scale.setScalar(size)

    const mode = world.night ? 'night' : world.weather === 'rain' ? 'rain' : world.dusk ? 'dusk' : 'day'
    const P = PALETTES[mode]
    sky.material.uniforms.uTop.value.set(P.top); sky.material.uniforms.uBottom.value.set(P.bottom)
    sun.color.set(P.sun); sun.intensity = P.sunI
    hemi.color.set(P.hemiSky); hemi.groundColor.set(P.hemiGround); hemi.intensity = P.hemiI
    scene.fog.color.set(world.fog ? '#c9d0dc' : P.fog)
    scene.fog.near = world.fog ? 14 : 40; scene.fog.far = world.fog ? 45 : 90
    water.material.uniforms.uDim.value = P.dim
    stars.visible = world.night; moon.visible = world.night
    rain.visible = world.weather === 'rain'; state.rain = rain.visible
    sun.position.set(world.night ? -12 : world.dusk ? 22 : 14, world.night ? 18 : world.dusk ? 8 : 22, world.night ? -8 : 10)

    // clouds by weather
    const nClouds = world.weather === 'clear' ? 3 : world.weather === 'cloudy' ? 7 : 10
    const cloudKey = `${nClouds}|${world.weather === 'rain'}`
    if (state.cloudKey !== cloudKey) {
    state.cloudKey = cloudKey
    clouds.children.forEach((c) => c.traverse((m) => { m.geometry?.dispose(); m.material?.dispose() }))
    clouds.clear()
    for (let i = 0; i < nClouds; i++) {
      const c = makeCloud(world.weather === 'rain')
      c.position.set(-30 + ((i * 17) % 60), 11 + (i % 3) * 1.6, -14 + ((i * 11) % 28))
      c.scale.setScalar(1 + (i % 3) * 0.35)
      clouds.add(c)
    }
    }

    // objects
    objects.clear()
    const place = (o, node) => {
      const x = o.u * R * 0.74
      const z = o.v * R * 0.74
      node.position.set(x, Math.max(0.15, heightAt(x, z)) - 0.02, z)
      node.rotation.y = o.seed * Math.PI * 2
      node.userData.obj = o
      objects.add(node)
    }
    world.trees.forEach((t) => place(t, makeTree(kit, t)))
    world.houses.forEach((h) => place(h, makeHouse(kit, h, world.night)))
    world.landmarks.forEach((l) => place(l, makeLandmark(kit, l)))
    // a few rocks + crystals for texture, fixed spots
    for (let i = 0; i < 9; i++) {
      const ang = i * 2.39, rr = R * (0.55 + (i % 3) * 0.12)
      const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr
      const n = mesh(kit.geo.rock, i % 2 ? kit.mat.rock : kit.mat.rockDark, { x, y: heightAt(x, z) + 0.05, z, sx: 0.8 + (i % 3) * 0.3, sy: 0.6, sz: 0.9 })
      objects.add(n)
    }

    boats.clear()
    for (let i = 0; i < world.boats; i++) { const b = makeShip(kit); b.scale.setScalar(0.55); b.userData.a = i * 1.9; boats.add(b) }
  }, [world])

  // highlight
  useEffect(() => {
    const a = api.current
    if (!a) return
    const node = picked && a.objects.children.find((n) => n.userData.obj?.id === picked)
    a.marker.visible = !!node
    if (node) {
      const p = new THREE.Vector3(); node.getWorldPosition(p)
      a.marker.position.set(p.x, p.y + 0.06, p.z)
      a.marker.scale.setScalar(a.state.size * (node.userData.obj.kind === 'house' ? 1 : 1.3))
    }
  }, [picked, world])

  return <div ref={hostRef} className={`wd-3d ${compact ? 'is-compact' : ''} ${className}`} />
}
