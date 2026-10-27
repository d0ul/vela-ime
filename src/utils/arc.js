/*
 * Lay a short title along the curved top of the Band's stadium-shaped screen, like Wear OS's curved text.
 * The top end is a half circle of radius 106 centred at (106, 106); each character is placed on a smaller
 * circle and rotated to follow it, so nothing is cut off by the bezel.
 */
const HANGUL = /[ㄱ-ㆎ가-힣]/

/** The rotation is a stylesheet class (rp12 = 12deg, rn12 = -12deg, 2deg steps): a bound inline transform crashes the engine. */
const rotClass = (deg) => {
  const q = Math.abs(Math.round(deg / 2) * 2)
  return (deg < 0 && q ? 'rn' : 'rp') + q
}

/** Every glyph box is BOX_W x BOX_H (see .ac in pages/ime): the engine's transform pivot must be set in px, so the size is fixed. */
const BOX_W = 24
const BOX_H = 26

/** Returns [{ c, left, top, fs, deg, cls }] for absolutely positioned <text> elements. */
export function arcText(text, opts) {
  const o = opts || {}
  const r = o.radius || 88
  const cx = o.cx || 106
  const cy = o.cy || 106
  let size = o.size || 20
  const maxArc = (((o.maxDeg || 100) * Math.PI) / 180) * r

  const adv = (ch, fs) => (ch === ' ' || ch === ':' || ch === '.' ? 0.32 : HANGUL.test(ch) ? 1.02 : 0.58) * fs
  const total = (fs) => {
    let n = 0
    for (let i = 0; i < text.length; i++) n += adv(text[i], fs)
    return n
  }
  const t = total(size)
  if (t > maxArc) size = Math.floor((size * maxArc) / t) // a long title shrinks instead of wrapping round the corner

  const out = []
  let s = -total(size) / 2 // arc length from the top centre, negative to the left
  for (let i = 0; i < text.length; i++) {
    const w = adv(text[i], size)
    const mid = s + w / 2
    s += w
    if (text[i] === ' ') continue
    const phi = mid / r
    const x = cx + r * Math.sin(phi)
    const y = cy - r * Math.cos(phi)
    const deg = (phi * 180) / Math.PI
    out.push({
      c: text[i],
      left: Math.round(x - BOX_W / 2),
      top: Math.round(y - BOX_H / 2),
      fs: size,
      deg: Math.round(deg * 10) / 10,
      cls: rotClass(deg)
    })
  }
  return out
}
