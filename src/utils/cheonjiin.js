/*
 * 천지인 (Cheonjiin) composition as a small state machine.
 *
 * press(text, key, editing) takes the text typed so far and returns the new text, the same contract
 * as hwalja's lookup tables (MIT, https://github.com/anaclumos/hwalja), which the tests check against.
 * Only the last one or two characters of `text` are looked at.
 */

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'
const ARAE = ['ᆞ', 'ᆢ'] // ᆞ and ᆢ: the in-progress ㆍ and ㆍㆍ

/** Final-consonant clusters as [kept, spilled-to-next-syllable] when a vowel follows. */
const CLUSTER = {
  ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ',
  ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ'
}

/** Consonant keys: the letters one key cycles through, and the transitions of a syllable's final. */
const CONSONANT = {
  'ㄱㅋ': { cycle: 'ㄱㅋㄲ', final: { ㄱ: ['ㅋ'], ㅋ: ['ㄲ'], ㄹ: ['ㄺ'], ㄺ: ['ㄹ', 'ㅋ'] }, merge: {} },
  'ㄴㄹ': { cycle: 'ㄴㄹ', final: { ㄴ: ['ㄹ'] }, merge: {} },
  'ㄷㅌ': { cycle: 'ㄷㅌㄸ', final: { ㄷ: ['ㅌ'], ㅌ: ['', 'ㄸ'], ㄾ: ['ㄹ', 'ㄸ'] }, merge: { ㄹㄷ: 'ㄾ' } },
  'ㅂㅍ': { cycle: 'ㅂㅍㅃ', final: { ㅂ: ['ㅍ'], ㅍ: ['', 'ㅃ'], ㄹ: ['ㄼ'], ㄼ: ['ㄹ', 'ㅍ'], ㄿ: ['ㄹ', 'ㅃ'] }, merge: { ㄹㅂ: 'ㄿ' } },
  'ㅅㅎ': {
    cycle: 'ㅅㅎㅆ',
    final: { ㅅ: ['ㅎ'], ㅎ: ['ㅆ'], ㄱ: ['ㄳ'], ㄳ: ['ㄱ', 'ㅎ'], ㄶ: ['ㄴ', 'ㅆ'], ㄹ: ['ㄽ'], ㄽ: ['ㅀ'], ㅀ: ['ㄹ', 'ㅆ'], ㅂ: ['ㅄ'], ㅄ: ['ㅂ', 'ㅎ'] },
    merge: { ㄴㅅ: 'ㄶ', ㄹㅅ: 'ㅀ' }
  },
  'ㅈㅊ': { cycle: 'ㅈㅊㅉ', final: { ㅈ: ['ㅊ'], ㅊ: ['', 'ㅉ'], ㄴ: ['ㄵ'], ㄵ: ['ㄴ', 'ㅊ'] }, merge: {} },
  'ㅇㅁ': { cycle: 'ㅇㅁ', final: { ㅇ: ['ㅁ'], ㄻ: ['ㄹ', 'ㅇ'] }, merge: { ㄹㅇ: 'ㄻ' } }
}

/** Vowel keys ㆍ(천) ㅡ(지) ㅣ(인): current vowel -> vowel after the press. '' is the start. */
const VOWEL = {
  천: { '': ARAE[0], [ARAE[0]]: ARAE[1], ㅣ: 'ㅏ', ㅡ: 'ㅜ', ㅏ: 'ㅑ', ㅜ: 'ㅠ', ㅚ: 'ㅘ' },
  지: { '': 'ㅡ', [ARAE[0]]: 'ㅗ', [ARAE[1]]: 'ㅛ' },
  인: {
    '': 'ㅣ', [ARAE[0]]: 'ㅓ', [ARAE[1]]: 'ㅕ', ㅏ: 'ㅐ', ㅑ: 'ㅒ', ㅓ: 'ㅔ', ㅕ: 'ㅖ',
    ㅗ: 'ㅚ', ㅜ: 'ㅟ', ㅡ: 'ㅢ', ㅠ: 'ㅝ', ㅝ: 'ㅞ', ㅘ: 'ㅙ'
  }
}

export const KEYS = [...Object.keys(CONSONANT), ...Object.keys(VOWEL)]

/* A unit is what one character position holds: { c: initial, v: vowel, j: final }. */
const bare = (c) => ({ c, v: '', j: '' })
const set = (u, patch) => Object.assign({}, u, patch)
const complete = (v) => JUNG.includes(v)

function render(u) {
  if (!u.v) return u.c
  if (!u.c) return u.v
  if (!complete(u.v)) return String.fromCharCode(0x1100 + CHO.indexOf(u.c)) + u.v // ᄀᆞ, ᄀᆢ
  const j = u.j ? JONG.indexOf(u.j) : 0
  return String.fromCharCode(0xac00 + (CHO.indexOf(u.c) * 21 + JUNG.indexOf(u.v)) * 28 + j)
}

/** Parse the last unit of text: { u, len } with len characters consumed, or null if not composable. */
function lastUnit(text) {
  const ch = text.charCodeAt(text.length - 1)
  if (ch >= 0xac00 && ch <= 0xd7a3) {
    const i = ch - 0xac00
    return { len: 1, u: { c: CHO[(i / 588) | 0], v: JUNG[((i % 588) / 28) | 0], j: i % 28 ? JONG[i % 28] : '' } }
  }
  if (ch >= 0x3131 && ch <= 0x314e) {
    const c = text[text.length - 1]
    return CHO.includes(c) ? { len: 1, u: bare(c) } : null
  }
  if (ch >= 0x314f && ch <= 0x3163) return { len: 1, u: { c: '', v: text[text.length - 1], j: '' } }
  if (ARAE.includes(text[text.length - 1])) {
    const p = text.charCodeAt(text.length - 2) - 0x1100
    if (p >= 0 && p < 19) return { len: 2, u: { c: CHO[p], v: text[text.length - 1], j: '' } }
    return { len: 1, u: { c: '', v: text[text.length - 1], j: '' } }
  }
  return null
}

const replace = (text, len, ...units) => text.slice(0, text.length - len) + units.filter(Boolean).map(render).join('')

function pressConsonant(text, key, u, len) {
  const { cycle, final, merge } = CONSONANT[key]
  if (u.c && !u.v) {
    // A bare consonant after a syllable may merge into that syllable's final (ㄹ + ㅅ -> ㅀ).
    const p = lastUnit(text.slice(0, text.length - len))
    if (p && p.len === 1 && p.u.j && !CLUSTER[p.u.j]) {
      const merged = merge[p.u.j + u.c]
      if (merged) return replace(text, len + 1, set(p.u, { j: merged }))
    }
    const i = cycle.indexOf(u.c)
    if (i >= 0 && i + 1 < cycle.length) return replace(text, len, bare(cycle[i + 1]))
  } else if (u.c && complete(u.v)) {
    if (!u.j) return replace(text, len, set(u, { j: cycle[0] }))
    const step = final[u.j]
    if (step) return replace(text, len, set(u, { j: step[0] }), step[1] ? bare(step[1]) : null)
  }
  return text + bare(cycle[0]).c
}

function pressVowel(text, key, u, len) {
  const next = VOWEL[key]
  if (u.c && complete(u.v) && u.j) {
    // The final moves to the next syllable: 각 + ㆍ -> 가 + ᄀᆞ.
    const [keep, move] = CLUSTER[u.j] ? CLUSTER[u.j] : ['', u.j]
    return replace(text, len, set(u, { j: keep }), { c: move, v: next[''], j: '' })
  }
  if (!u.v) return replace(text, len, { c: u.c, v: next[''], j: '' })
  // A lone ㅡ followed by ㅣ stays two letters; ㅢ needs an initial consonant (as in hwalja).
  const lone = key === '인' && !u.c && u.v === 'ㅡ'
  if (next[u.v] !== undefined && !lone) return replace(text, len, set(u, { v: next[u.v] }))
  return text + next['']
}

/** Press `key`; `editing` false starts a fresh character instead of editing the last one. */
export function press(text, key, editing = true) {
  const fresh = () => text + (CONSONANT[key] ? CONSONANT[key].cycle[0] : VOWEL[key][''])
  if (!editing || !text) return fresh()
  const last = lastUnit(text)
  if (!last) return fresh()
  return (CONSONANT[key] ? pressConsonant : pressVowel)(text, key, last.u, last.len)
}

/* ---- searching by what is being typed ---------------------------------------------------- */

/** The keys that type each vowel; a title is searched by these atoms, not by its syllables. */
export const VOWEL_ATOMS = {
  ㅏ: 'ㅣㆍ', ㅑ: 'ㅣㆍㆍ', ㅓ: 'ㆍㅣ', ㅕ: 'ㆍㆍㅣ', ㅗ: 'ㆍㅡ', ㅛ: 'ㆍㆍㅡ', ㅜ: 'ㅡㆍ', ㅠ: 'ㅡㆍㆍ',
  ㅡ: 'ㅡ', ㅣ: 'ㅣ', ㅐ: 'ㅣㆍㅣ', ㅒ: 'ㅣㆍㆍㅣ', ㅔ: 'ㆍㅣㅣ', ㅖ: 'ㆍㆍㅣㅣ', ㅚ: 'ㆍㅡㅣ',
  ㅘ: 'ㆍㅡㅣㆍ', ㅙ: 'ㆍㅡㅣㆍㅣ', ㅟ: 'ㅡㆍㅣ', ㅝ: 'ㅡㆍㆍㅣ', ㅞ: 'ㅡㆍㆍㅣㅣ', ㅢ: 'ㅡㅣ'
}

/**
 * Text as key atoms: consonant letters (clusters as two letters) and the ㆍ ㅡ ㅣ strokes of each vowel.
 * Syllable boundaries drop out, so 캍 is a prefix of 카트. Characters that cannot be typed are skipped.
 */
export function atoms(text) {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const o = text.charCodeAt(i)
    if (o >= 0xac00 && o <= 0xd7a3) {
      const n = o - 0xac00
      const jong = n % 28 ? JONG[n % 28] : ''
      out += CHO[(n / 588) | 0] + VOWEL_ATOMS[JUNG[((n % 588) / 28) | 0]] + (CLUSTER[jong] || jong)
    } else if (o >= 0x1100 && o <= 0x1112) out += CHO[o - 0x1100]
    else if (ch === ARAE[0]) out += 'ㆍ'
    else if (ch === ARAE[1]) out += 'ㆍㆍ'
    else if (ch === 'ㆍ') out += 'ㆍ'
    else if (VOWEL_ATOMS[ch]) out += VOWEL_ATOMS[ch]
    else if (o >= 0x3131 && o <= 0x314e) out += CLUSTER[ch] || ch
  }
  return out
}

/** Text for the screen: in-progress ㆍ shown as a dot, since the Band's font may lack the raw jamo. */
export function display(text) {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const o = text.charCodeAt(i)
    if (o >= 0x1100 && o <= 0x1112) out += CHO[o - 0x1100]
    else if (ch === ARAE[0]) out += '·'
    else if (ch === ARAE[1]) out += '··'
    else out += ch
  }
  return out
}

/** Remove the last character as a person sees it: 사과 -> 사, and an in-progress ᄀᆞ goes whole. */
export function backspace(text) {
  const n = text.length
  if (n === 0) return text
  const last = text.charCodeAt(n - 1)
  const before = n > 1 ? text.charCodeAt(n - 2) : 0
  if ((last === 0x119e || last === 0x11a2) && before >= 0x1100 && before <= 0x1112) return text.slice(0, -2)
  return text.slice(0, -1)
}
