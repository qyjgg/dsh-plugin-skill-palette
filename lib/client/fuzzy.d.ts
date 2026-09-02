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
export declare function fuzzyMatchSkill<T extends {
    name: string;
    description: string;
}>(item: T, rawQuery: string): MatchResult<T> | null;
//# sourceMappingURL=fuzzy.d.ts.map