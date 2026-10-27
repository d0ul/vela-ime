/*
 * Word suggestions for the keyboard's strip. Replace this file with your own (the keyboard page imports `suggest` from it).
 *
 * `q` is what has been typed since the last space, as key atoms (see atoms() in cheonjiin.js: ㅣ ㆍ ㅡ and the
 * consonant keys). Return up to `limit` words whose atoms start with `q`, best first. Matching a dictionary is
 * simply `atoms(word).indexOf(q) === 0`.
 */
export async function suggest(q, limit) {
  return []
}
