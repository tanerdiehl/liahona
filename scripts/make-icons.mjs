// Generates the app icons (a simple compass) as PNGs with no dependencies.
// Run: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x3b, 0x4a, 0x6b] // navy
const RING = [0xf6, 0xf5, 0xf1]
const NORTH = [0x7f, 0x77, 0xdd] // indigo
const SOUTH = [0xf6, 0xf5, 0xf1]

function crc32(buf) {
  let c
  const table = crc32.table ??= Array.from({ length: 256 }, (_, n) => {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  const SS = 4 // supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)
          r += c[0]; g += c[1]; b += c[2]
        }
      const o = y * (size * 3 + 1) + 1 + x * 3
      raw[o] = r / SS / SS
      raw[o + 1] = g / SS / SS
      raw[o + 2] = b / SS / SS
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Point-in-triangle via barycentric signs.
function inTri(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3)
  const d1 = s(px, py, ax, ay, bx, by)
  const d2 = s(px, py, bx, by, cx, cy)
  const d3 = s(px, py, cx, cy, ax, ay)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

// Coordinates are 0..1. `scale` shrinks the artwork for maskable icons.
function compass(scale) {
  return (u, v) => {
    const x = (u - 0.5) / scale
    const y = (v - 0.5) / scale
    const r = Math.hypot(x, y)
    const w = 0.07 // needle half-width
    if (inTri(x, y, [0, -0.3], [-w, 0], [w, 0])) return NORTH
    if (inTri(x, y, [0, 0.3], [-w, 0], [w, 0])) return SOUTH
    if (r > 0.36 && r < 0.395) return RING
    return BG
  }
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', png(192, compass(1)))
writeFileSync('public/icons/icon-512.png', png(512, compass(1)))
writeFileSync('public/icons/maskable-512.png', png(512, compass(0.8)))
writeFileSync('public/icons/apple-touch-icon.png', png(180, compass(0.9)))
console.log('icons written to public/icons/')
