/* French text normalisation for the deterministic router: lowercase, no accents, no punctuation. */

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9%&\s-]/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word (or whole-phrase) test on a normalised string. */
export function hasPhrase(norm: string, phrase: string): boolean {
  const p = normalize(phrase);
  return !!p && new RegExp(`(^| )${escapeRe(p)}( |$)`).test(norm);
}
/** Position of a whole phrase in a normalised string (-1 when absent). */
export function phraseIndex(norm: string, phrase: string): number {
  const p = normalize(phrase);
  if (!p) return -1;
  const m = new RegExp(`(^| )${escapeRe(p)}( |$)`).exec(norm);
  return m ? m.index + (m[1] ? 1 : 0) : -1;
}
