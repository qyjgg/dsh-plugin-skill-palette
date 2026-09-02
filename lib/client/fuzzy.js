/**
 * High-performance Tiered Weighted Fuzzy Matching Engine for Skills & Commands.
 */
/**
 * 4-Tier weighted fuzzy scoring:
 * Tier 1 (1000+): Exact prefix match on skill name (e.g. 'code' -> 'code-review')
 * Tier 1.5 (800+): Substring match on skill name (e.g. 'review' -> 'code-review')
 * Tier 2 (500+): Subsequence & word-boundary fuzzy match on name (e.g. 'cr' -> 'code-review')
 * Tier 3 (200+): Keyword / word-boundary match in description (e.g. 'test' -> 'tdd')
 * Tier 4 (100+): Subsequence fuzzy match in description
 */
export function fuzzyMatchSkill(item, rawQuery) {
    const query = rawQuery.trim().toLowerCase();
    if (!query) {
        return { item, score: 0, nameHighlights: [], descHighlights: [] };
    }
    const nameLower = item.name.toLowerCase();
    const descLower = item.description.toLowerCase();
    // Tier 1: Name prefix exact match
    if (nameLower.startsWith(query)) {
        return {
            item,
            score: 1000 + (100 - nameLower.length),
            nameHighlights: [{ start: 0, end: query.length }],
            descHighlights: [],
        };
    }
    // Tier 1.5: Name substring match
    const subIdx = nameLower.indexOf(query);
    if (subIdx !== -1) {
        return {
            item,
            score: 800 + (100 - subIdx),
            nameHighlights: [{ start: subIdx, end: subIdx + query.length }],
            descHighlights: [],
        };
    }
    // Tier 2: Subsequence & boundary match on name
    const nameSubseq = matchSubsequence(nameLower, query);
    if (nameSubseq) {
        return {
            item,
            score: 500 + nameSubseq.score,
            nameHighlights: nameSubseq.highlights,
            descHighlights: [],
        };
    }
    // Tier 3: Description keyword substring match
    const descSubIdx = descLower.indexOf(query);
    if (descSubIdx !== -1) {
        return {
            item,
            score: 200 + (50 - Math.min(descSubIdx, 50)),
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
 * Match subsequence with word-boundary and continuity bonuses.
 */
function matchSubsequence(target, query) {
    let tIdx = 0;
    let qIdx = 0;
    let score = 0;
    let consecutive = 0;
    const highlights = [];
    let currentSpan = null;
    while (tIdx < target.length && qIdx < query.length) {
        const tChar = target[tIdx];
        const qChar = query[qIdx];
        if (tChar === qChar) {
            // Word boundary bonus (start of string, after '-', '_', ' ')
            const isBoundary = tIdx === 0 ||
                target[tIdx - 1] === '-' ||
                target[tIdx - 1] === '_' ||
                target[tIdx - 1] === ' ';
            if (isBoundary)
                score += 35;
            // Consecutive match bonus
            score += 10 + consecutive * 5;
            consecutive++;
            if (!currentSpan) {
                currentSpan = { start: tIdx, end: tIdx + 1 };
            }
            else {
                currentSpan.end = tIdx + 1;
            }
            qIdx++;
        }
        else {
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
//# sourceMappingURL=fuzzy.js.map