// Renders the keyboard's icons (Lucide, ISC licence) as white 8-bit indexed PNGs into src/common/ime.
// Usage: npm install lucide-static sharp  &&  node tools/icons.mjs
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '../src/common/ime')
const ICONS = { delete: 40, globe: 40, space: 40, check: 48 } // icon -> px (the engine crops an image to its box, so show each at this size)
const STROKE = 2.4 // heavier than Lucide's 2 so thin strokes survive 8-bit indexing on a small screen
fs.mkdirSync(out, { recursive: true })
for (const [name, size] of Object.entries(ICONS)) {
  const svg = fs.readFileSync(path.join(here, '../node_modules/lucide-static/icons', name + '.svg'), 'utf8')
    .replace(/currentColor/g, '#ffffff').replace(/stroke-width="[\d.]+"/, `stroke-width="${STROKE}"`)
  await sharp(Buffer.from(svg), { density: 96 * (size / 24) * 2 }).resize(size, size)
    .png({ palette: true, colors: 32, compressionLevel: 9 }).toFile(path.join(out, `${name}-${size}.indexed_8.png`))
}
