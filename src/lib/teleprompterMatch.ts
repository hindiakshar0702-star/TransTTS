/**
 * Teleprompter word-matching — pure, deterministic, and unit-testable.
 *
 * The teleprompter drives its highlight from the browser Web Speech API, which
 * frequently drops or merges short function words ("to", "the", "a", "is") in
 * its interim/final transcripts. The old matcher searched a 5-word window for
 * the first fuzzy match and capped advances at +2 per event, so a dropped short
 * word made the pointer jump ahead (skipping the dropped word) or lag behind.
 *
 * This module instead walks the spoken words sequentially: each spoken word is
 * matched against the *next expected* script word first, then a small lookahead
 * window (to recover when the engine genuinely dropped an intermediate word).
 * The pointer advances one script word per matched spoken word and never moves
 * backward. Intermediate words that had to be skipped are covered by the
 * caller's render (any index < the pointer renders as "completed"), so no word
 * is left silently un-highlighted.
 */

const PUNCT = /[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g;

/** Lowercase, strip punctuation, split on whitespace, drop empties. */
export function cleanToWords(text: string): string[] {
  return text.toLowerCase().replace(PUNCT, "").split(/\s+/).filter(Boolean);
}

/** Classic Levenshtein edit distance (for fuzzy matching longer words). */
export function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Is a spoken word a plausible match for a script word?
 * Short words (<= 4 chars) require an EXACT match so common fillers like
 * "to"/"the"/"is" can never fuzzy-match their way onto the wrong word.
 */
export function isFuzzyMatch(spoken: string, scriptWord: string): boolean {
  if (!spoken || !scriptWord) return false;
  const s1 = spoken.toLowerCase().trim();
  const s2 = scriptWord.toLowerCase().trim();
  if (s1 === s2) return true;
  if (s1.length <= 4 || s2.length <= 4) return s1 === s2;
  if (s1.length >= 5 && s2.length >= 5) {
    if (s1.startsWith(s2.slice(0, 4)) || s2.startsWith(s1.slice(0, 4))) return true;
  }
  const maxDist = Math.max(1, Math.floor(s2.length * 0.25));
  return levenshtein(s1, s2) <= maxDist;
}

/**
 * Compute the new highlight index given the cleaned script words, the current
 * highlight index, and the cleaned spoken words from a recognition event.
 *
 * - Advances one script word per matched spoken word (no artificial cap).
 * - `lookahead` recovers when the engine dropped intermediate short words.
 * - Never returns an index lower than `currentIndex` (no backward jumps).
 * - Unmatched spoken words (mis-transcriptions/noise) leave the pointer put.
 */
/**
 * Delta-feeder for Web Speech API results. Interim transcripts are CUMULATIVE
 * per utterance ("welcome", "welcome to", "welcome to the", ...), so feeding a
 * whole interim to the matcher re-processes words it already consumed — a
 * stale short word ("to"/"the") can then lookahead-match a duplicate a few
 * script words ahead and make the highlight jump. This feeder guarantees every
 * spoken word is surfaced exactly once, in order.
 *
 * Usage per recognition event:
 *   - feed.interim(words): returns only the newly appended interim words.
 *   - feed.final(words): returns the words of the final transcript not already
 *     surfaced via interim, and resets for the next utterance.
 *   - feed.reset(): call when a recognition session ends/restarts.
 */
export function createUtteranceFeed() {
  let fed = 0;
  return {
    interim(words: string[]): string[] {
      // Engine revised earlier words (count shrank/equal): surface nothing —
      // the final transcript settles the utterance.
      if (words.length <= fed) return [];
      const fresh = words.slice(fed);
      fed = words.length;
      return fresh;
    },
    final(words: string[]): string[] {
      const unfed = words.slice(fed);
      fed = 0;
      return unfed;
    },
    reset(): void {
      fed = 0;
    },
  };
}

export function computeHighlightIndex(
  cleanWords: string[],
  currentIndex: number,
  spokenWords: string[],
  lookahead = 3
): number {
  if (cleanWords.length === 0) return currentIndex;
  let ptr = currentIndex;

  for (const spoken of spokenWords) {
    if (!spoken) continue;
    const expected = ptr + 1;
    if (expected >= cleanWords.length) break;

    // 1. Direct hit on the very next expected word — the normal path.
    if (isFuzzyMatch(spoken, cleanWords[expected])) {
      ptr = expected;
      continue;
    }

    // 2. Lookahead: the engine may have dropped 1–`lookahead` intermediate
    //    words. Advance to the nearest later word this spoken word matches;
    //    the skipped words render as "completed" (passed), not lost.
    const end = Math.min(cleanWords.length, expected + 1 + lookahead);
    let matched = -1;
    for (let s = expected + 1; s < end; s++) {
      if (isFuzzyMatch(spoken, cleanWords[s])) {
        matched = s;
        break;
      }
    }
    if (matched !== -1) ptr = matched;
    // 3. No match anywhere in the window → leave pointer put (don't jump on noise).
  }

  return ptr;
}
