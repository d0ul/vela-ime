// Compares press() with hwalja's lookup tables over every prior state we can build.
// Usage: node tests/cheonjiin.test.mjs [path to a hwalja checkout]
import fs from 'fs'
import path from 'path'
import { press, KEYS, atoms, VOWEL_ATOMS, backspace } from '../src/utils/cheonjiin.js'

const dir = process.argv[2] || process.env.HWALJA_SRC || '../hwalja-ref/src'
const table = Object.fromEntries(KEYS.map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8'))]))

/** hwalja's own five-line `type`, the reference behaviour. */
function oracle(prev, key, editing) {
  const one = prev.slice(-1)
  const two = prev.slice(-2)
  if (editing && two in table[key]) return prev.slice(0, -2) + table[key][two]
  if (editing && one in table[key]) return prev.slice(0, -1) + table[key][one]
  return prev + table[key]['']
}

const chars = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCharCode(a + i))
const syllables = chars(0xac00, 0xd7a3)
const consonants = chars(0x3131, 0x314e)
const vowels = chars(0x314f, 0x3163)
const cv = []
for (let c = 0x1100; c <= 0x1112; c++) for (const a of ['ᆞ', 'ᆢ']) cv.push(String.fromCharCode(c) + a)

const priors = ['', ...syllables, ...consonants, ...vowels, 'ᆞ', 'ᆢ', ...cv]
// A bare consonant after a syllable is where merges happen (갈 + ㅅ ...), so cover all of those too.
const initials = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.split('')
for (const s of syllables) for (const k of initials) priors.push(s + k)
// Bare vowels after a syllable, and a few unrelated tails.
for (const s of ['가', '각', '값', '갈']) for (const v of [...vowels, 'ᆞ', 'ᆢ']) priors.push(s + v)

// Whole words typed the way a person would, key by key.
const words = {
  카트라이더: ['ㄱㅋ', 'ㄱㅋ', '인', '천', 'ㄷㅌ', 'ㄷㅌ', '지', 'ㄴㄹ', 'ㄴㄹ', '인', '천', 'ㅇㅁ', '인', 'ㄷㅌ', '천', '인'],
  넥슨: ['ㄴㄹ', '천', '인', '인', 'ㄱㅋ', 'ㅅㅎ', '지', 'ㄴㄹ'],
  값: ['ㄱㅋ', '인', '천', 'ㅂㅍ', 'ㅅㅎ'],
  의: ['ㅇㅁ', '지', '인'],
  뭐: ['ㅇㅁ', 'ㅇㅁ', '지', '천', '천', '인']
}
for (const [word, keys] of Object.entries(words)) {
  const got = keys.reduce((t, k) => press(t, k), '')
  if (got !== word) { console.log(`word ${word}: got ${got}`); process.exitCode = 1 }
}

// Every vowel is typed by its atoms: ㅇ then the strokes must give back 으 + that vowel.
const KEY_OF = { ㆍ: '천', ㅡ: '지', ㅣ: '인' }
const JUNG_ORDER = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
for (const [v, a] of Object.entries(VOWEL_ATOMS)) {
  const got = [...a].reduce((t, ch) => press(t, KEY_OF[ch]), press('', 'ㅇㅁ'))
  const want = String.fromCharCode(0xac00 + (11 * 21 + JUNG_ORDER.indexOf(v)) * 28)
  if (got !== want) { console.log(`vowel ${v}: atoms ${a} typed ${got}, want ${want}`); process.exitCode = 1 }
}
// A typed word has its title's atoms, and every half-typed state's atoms are a prefix of them
// (except mid-cycle on a consonant key, where the shown letter is not yet the final one).
const CYCLING = new Set(['ㄱㅋ', 'ㄴㄹ', 'ㄷㅌ', 'ㅂㅍ', 'ㅅㅎ', 'ㅈㅊ', 'ㅇㅁ'])
for (const [word, keys] of Object.entries(words)) {
  if (atoms(keys.reduce((t, k) => press(t, k), '')) !== atoms(word)) { console.log(`atoms ${word}`); process.exitCode = 1 }
  let t = ''
  for (const k of keys) {
    t = press(t, k)
    if (!CYCLING.has(k) && !atoms(word).startsWith(atoms(t))) { console.log(`prefix ${word}: ${t}`); process.exitCode = 1 }
  }
}

// 지움 removes a whole character: 사과 -> 사, never one key press.
const bs = [['사과', '사'], ['사', ''], ['', ''], ['가 나', '가 '], ['ㄱ' + String.fromCharCode(0x119e), 'ㄱ'], [String.fromCharCode(0x1100, 0x119e), ''], [String.fromCharCode(0x1100, 0x11a2), ''], ['값', '']]
for (const [from, to] of bs) {
  if (backspace(from) !== to) { console.log(`backspace ${JSON.stringify(from)} -> ${JSON.stringify(backspace(from))}, want ${JSON.stringify(to)}`); process.exitCode = 1 }
}

let total = 0
const bad = new Map()
for (const prev of priors) {
  for (const key of KEYS) {
    for (const editing of [true, false]) {
      total++
      const want = oracle(prev, key, editing)
      const got = press(prev, key, editing)
      if (want !== got) {
        const tag = key + ' ' + (prev.length > 1 ? 'len' + prev.length : /[가-힣]/.test(prev) ? 'syllable' : 'jamo')
        if (!bad.has(tag)) bad.set(tag, [])
        bad.get(tag).push([prev, key, editing, want, got])
      }
    }
  }
}
const nbad = [...bad.values()].reduce((n, v) => n + v.length, 0)
console.log(`${total} cases, ${nbad} mismatches`)
for (const [tag, rows] of bad) {
  console.log(`\n${tag}: ${rows.length}`)
  for (const [p, k, e, w, g] of rows.slice(0, 4)) console.log(`  ${JSON.stringify(p)} + ${k} (editing=${e}): want ${JSON.stringify(w)}, got ${JSON.stringify(g)}`)
}
process.exit(nbad ? 1 : process.exitCode || 0)
