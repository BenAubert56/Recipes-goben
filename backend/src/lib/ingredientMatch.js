// Groups ingredient spellings that are one letter apart (typically a
// singular/plural pair like "oeuf"/"oeufs") so they resolve to the same
// ingredient row instead of creating shopping-list duplicates.

const DIACRITICS_RE = new RegExp(String.fromCharCode(0x5b, 0x5c, 0x75, 0x30, 0x33, 0x30, 0x30, 0x2d, 0x5c, 0x75, 0x30, 0x33, 0x36, 0x66, 0x5d), "g");

function normalizeForMatch(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_RE, "") // strip accents (combining diacritical marks range)
    .replace(/\s+/g, " ");
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// `key` values are already normalizeForMatch()-ed.
// Guards against false positives: short words are compared exactly only
// (e.g. "riz"/"ris"), and words must share their first 3 letters so an
// unrelated 1-letter-edit word ("oeuf" -> "boeuf") never merges.
function isSameIngredient(keyA, keyB) {
  if (keyA === keyB) return true;
  if (Math.min(keyA.length, keyB.length) < 4) return false;
  if (Math.abs(keyA.length - keyB.length) > 1) return false;
  if (keyA.slice(0, 3) !== keyB.slice(0, 3)) return false;
  return levenshtein(keyA, keyB) <= 1;
}

module.exports = { normalizeForMatch, levenshtein, isSameIngredient };
