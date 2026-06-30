// Normalize a string for forgiving, accent- and separator-insensitive search.
// "ÇaRoule", "ca-roule", "Ça Roule" all collapse to "caroule" so a user can
// type the name however they like and still find it.
export function normalize(str) {
  return String(str ?? '')
    .normalize('NFD') // split accented chars into base + diacritic
    .replace(/[̀-ͯ]/g, '') // drop the combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '') // drop spaces, slashes, hyphens, punctuation
}

// True when `haystack` loosely contains `needle` (both normalized).
export function fuzzyMatch(haystack, needle) {
  const n = normalize(needle)
  if (!n) return true
  return normalize(haystack).includes(n)
}
