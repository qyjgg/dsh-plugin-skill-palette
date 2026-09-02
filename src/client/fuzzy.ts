/**
 * High-performance Tiered Weighted Fuzzy Matching Engine for Skills & Commands.
 */

export interface HighlightSpan {
  start: number;
  end: number;
}

export interface MatchResult<T> {
  item: T;
  score: number;
  nameHighlights: HighlightSpan[];
  descHighlights: HighlightSpan[];
}

/**
 * 4-Tier weighted fuzzy scoring:
 * Tier 1 (1000+): Exact prefix match on skill name (e.g. 'code' -> 'code-review')
 * Tier 1.5 (800+): Substring match on skill name (e.g. 'review' -> 'code-review')
 * Tier 2 (500+): Subsequence & word-boundary fuzzy match on name (e.g. 'cr' -> 'code-review')
 * Tier 3 (200+): Keyword / word-boundary match in description (e.g. 'test' -> 'tdd')
 * Tier 4 (100+): Subsequence fuzzy match in description
 */
export function fuzzyMatchSkill<T extends { name?: string; description?: string }>(
  item: T,
  rawQuery: string
): MatchResult<T> | null {
  const query = rawQuery.trim().toLowerCase();
  const nameLower = (item?.name ?? "").toLowerCase();
  const descLower = (item?.description ?? "").toLowerCase();

  if (!query) {
    return { item, score: 0, nameHighlights: [], descHighlights: [] };
  }
  if (!nameLower && !descLower) {
    return null;
  }

  // Tier 1: Name prefix exact match (e.g. 'code' -> 'code-review')
  if (nameLower.startsWith(query)) {
    return {
      item,
      score: 1000 + Math.max(0, 100 - nameLower.length),
      nameHighlights: [{ start: 0, end: query.length }],
      descHighlights: [],
    };
  }

  // Tier 1.8: Acronym / Word initials match (e.g. 'cc' -> 'caveman-commit', 'sd' -> 'systematic-debugging')
  const acronymResult = matchAcronym(nameLower, query);
  if (acronymResult) {
    return {
      item,
      score: acronymResult.score,
      nameHighlights: acronymResult.highlights,
      descHighlights: [],
    };
  }

  // Tier 1.5: Name substring match (e.g. 'review' -> 'code-review')
  const subIdx = nameLower.indexOf(query);
  if (subIdx !== -1) {
    return {
      item,
      score: 800 + Math.max(0, 100 - subIdx),
      nameHighlights: [{ start: subIdx, end: subIdx + query.length }],
      descHighlights: [],
    };
  }

  // Tier 2: Subsequence & boundary match on name (e.g. 'cdrv' -> 'code-review')
  const nameSubseq = matchSubsequence(nameLower, query);
  if (nameSubseq) {
    return {
      item,
      score: 500 + nameSubseq.score,
      nameHighlights: nameSubseq.highlights,
      descHighlights: [],
    };
  }

  // Tier 3: Description keyword substring match (e.g. 'test' -> 'tdd')
  const descSubIdx = descLower.indexOf(query);
  if (descSubIdx !== -1) {
    return {
      item,
      score: 200 + Math.max(0, 50 - Math.min(descSubIdx, 50)),
      nameHighlights: [],
      descHighlights: [{ start: descSubIdx, end: descSubIdx + query.length }],
    };
  }

  // Tier 4: Description subsequence match
  const descSubseq = matchSubsequence(descLower, query);
  if (descSubseq) {
    return {
      item,
      score: 100 + descSubseq.score,
      nameHighlights: [],
      descHighlights: descSubseq.highlights,
    };
  }

  return null;
}

/**
 * Match acronym / word initial letters.
 * e.g. 'caveman-commit' -> initials 'c', 'c'. Query 'cc' exact match.
 */
function matchAcronym(
  target: string,
  query: string
): { score: number; highlights: HighlightSpan[] } | null {
  if (!query || query.length < 2) return null;

  const initials: { char: string; index: number }[] = [];
  for (let i = 0; i < target.length; i++) {
    const isBoundary =
      i === 0 ||
      target[i - 1] === "-" ||
      target[i - 1] === "_" ||
      target[i - 1] === " " ||
      target[i - 1] === "/";
    const c = target[i];
    if (isBoundary && ((c >= "a" && c <= "z") || (c >= "0" && c <= "9"))) {
      initials.push({ char: c, index: i });
    }
  }

  if (initials.length < query.length) return null;

  const acronymStr = initials.map((it) => it.char).join("");

  // Exact acronym match (e.g. 'cc' for 'caveman-commit')
  if (acronymStr === query) {
    return {
      score: 950 + Math.max(0, 20 - target.length),
      highlights: initials.map((it) => ({ start: it.index, end: it.index + 1 })),
    };
  }

  // Prefix acronym match (e.g. 'cr' for 'code-review-expert')
  if (acronymStr.startsWith(query)) {
    const matchedInitials = initials.slice(0, query.length);
    return {
      score: 900 + Math.max(0, 20 - target.length),
      highlights: matchedInitials.map((it) => ({ start: it.index, end: it.index + 1 })),
    };
  }

  return null;
}

/**
 * Match subsequence with word-boundary and continuity bonuses.
 */
function matchSubsequence(
  target: string,
  query: string
): { score: number; highlights: HighlightSpan[] } | null {
  let tIdx = 0;
  let qIdx = 0;
  let score = 0;
  let consecutive = 0;
  const highlights: HighlightSpan[] = [];
  let currentSpan: HighlightSpan | null = null;

  while (tIdx < target.length && qIdx < query.length) {
    const tChar = target[tIdx];
    const qChar = query[qIdx];

    if (tChar === qChar) {
      // Word boundary bonus (start of string, after '-', '_', ' ')
      const isBoundary =
        tIdx === 0 ||
        target[tIdx - 1] === '-' ||
        target[tIdx - 1] === '_' ||
        target[tIdx - 1] === ' ';
      if (isBoundary) score += 35;

      // Consecutive match bonus
      score += 10 + consecutive * 5;
      consecutive++;

      if (!currentSpan) {
        currentSpan = { start: tIdx, end: tIdx + 1 };
      } else {
        currentSpan.end = tIdx + 1;
      }

      qIdx++;
    } else {
      consecutive = 0;
      if (currentSpan) {
        highlights.push(currentSpan);
        currentSpan = null;
      }
    }
    tIdx++;
  }

  if (currentSpan) {
    highlights.push(currentSpan);
  }

  if (qIdx === query.length) {
    return { score, highlights };
  }
  return null;
}
