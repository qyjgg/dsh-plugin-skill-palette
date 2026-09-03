window.__ModuleLoader__.load({
	id: "dsh-plugin-skill-palette",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/fuzzy.ts
		/**
		* 4-Tier weighted fuzzy scoring:
		* Tier 1 (1000+): Exact prefix match on skill name (e.g. 'code' -> 'code-review')
		* Tier 1.5 (800+): Substring match on skill name (e.g. 'review' -> 'code-review')
		* Tier 2 (500+): Subsequence & word-boundary fuzzy match on name (e.g. 'cr' -> 'code-review')
		* Tier 3 (200+): Keyword / word-boundary match in description (e.g. 'test' -> 'tdd')
		* Tier 4 (100+): Subsequence fuzzy match in description
		*/
		function fuzzyMatchSkill(item, rawQuery) {
			const query = (rawQuery ?? "").trim().toLowerCase();
			const nameLower = (item?.name ?? "").toLowerCase();
			const descLower = (item?.description ?? "").toLowerCase();
			if (!nameLower && !descLower) return null;
			if (!query) return {
				item,
				score: 0,
				nameHighlights: [],
				descHighlights: []
			};
			if (nameLower.startsWith(query)) return {
				item,
				score: (nameLower === query ? 1100 : 1e3) + Math.max(0, 100 - nameLower.length),
				nameHighlights: [{
					start: 0,
					end: query.length
				}],
				descHighlights: []
			};
			const acronymResult = matchAcronym(nameLower, query);
			if (acronymResult) return {
				item,
				score: acronymResult.score,
				nameHighlights: acronymResult.highlights,
				descHighlights: []
			};
			const subIdx = nameLower.indexOf(query);
			if (subIdx !== -1) return {
				item,
				score: 800 + Math.max(0, 100 - subIdx),
				nameHighlights: [{
					start: subIdx,
					end: subIdx + query.length
				}],
				descHighlights: []
			};
			const nameSubseq = matchSubsequence(nameLower, query);
			if (nameSubseq) return {
				item,
				score: 500 + Math.min(250, nameSubseq.score),
				nameHighlights: nameSubseq.highlights,
				descHighlights: []
			};
			const descSubIdx = descLower.indexOf(query);
			if (descSubIdx !== -1) return {
				item,
				score: 200 + Math.max(0, 50 - Math.min(descSubIdx, 50)),
				nameHighlights: [],
				descHighlights: [{
					start: descSubIdx,
					end: descSubIdx + query.length
				}]
			};
			const descSubseq = matchSubsequence(descLower, query);
			if (descSubseq) return {
				item,
				score: 100 + Math.min(90, descSubseq.score),
				nameHighlights: [],
				descHighlights: descSubseq.highlights
			};
			return null;
		}
		/**
		* Match acronym / word initial letters.
		* e.g. 'caveman-commit' -> initials 'c', 'c'. Query 'cc' exact match.
		*/
		function matchAcronym(target, query) {
			if (!query || query.length < 2) return null;
			const initials = [];
			for (let i = 0; i < target.length; i++) {
				const isBoundary = i === 0 || target[i - 1] === "-" || target[i - 1] === "_" || target[i - 1] === " " || target[i - 1] === "/";
				const c = target[i];
				if (isBoundary && (c >= "a" && c <= "z" || c >= "0" && c <= "9")) initials.push({
					char: c,
					index: i
				});
			}
			if (initials.length < query.length) return null;
			const acronymStr = initials.map((it) => it.char).join("");
			if (acronymStr === query) return {
				score: 950 + Math.max(0, 20 - target.length),
				highlights: initials.map((it) => ({
					start: it.index,
					end: it.index + 1
				}))
			};
			if (acronymStr.startsWith(query)) {
				const matchedInitials = initials.slice(0, query.length);
				return {
					score: 900 + Math.max(0, 20 - target.length),
					highlights: matchedInitials.map((it) => ({
						start: it.index,
						end: it.index + 1
					}))
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
				if (target[tIdx] === query[qIdx]) {
					if (tIdx === 0 || target[tIdx - 1] === "-" || target[tIdx - 1] === "_" || target[tIdx - 1] === " " || target[tIdx - 1] === "/") score += 35;
					score += 10 + consecutive * 5;
					consecutive++;
					if (!currentSpan) currentSpan = {
						start: tIdx,
						end: tIdx + 1
					};
					else currentSpan.end = tIdx + 1;
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
			if (currentSpan) highlights.push(currentSpan);
			if (qIdx === query.length) return {
				score,
				highlights
			};
			return null;
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* I18n translations for Enhanced Skill Slash Trigger.
		*/
		const NS = "skill-enhanced";
		const zh = {
			"menu.userOnly": "仅用户",
			"menu.section": "技能"
		};
		const en = {
			"menu.userOnly": "user-only",
			"menu.section": "Skills"
		};
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"inputTriggers",
			"connection",
			"sessions",
			"locale",
			"remote"
		];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-skill-enhanced: i18n");
			const skillsApi = ctx.get("connection").api.skills;
			const sessions = ctx.get("sessions");
			const inputTriggers = ctx.get("inputTriggers");
			const t = ctx.locale.bind(NS);
			const fetches = /* @__PURE__ */ new Map();
			const lexiconListeners = /* @__PURE__ */ new Map();
			const notifyLexicon = (sessionId) => {
				const set = lexiconListeners.get(sessionId);
				if (!set) return;
				for (const listener of Array.from(set)) try {
					listener();
				} catch (err) {
					console.error("[ui-skill-enhanced] lexicon listener error:", err);
				}
			};
			const fetchCatalog = (sessionId) => {
				if (sessions.subagentAddress?.(sessionId) !== void 0) return Promise.resolve([]);
				const existing = fetches.get(sessionId);
				if (existing !== void 0) return existing.promise;
				const abort = new AbortController();
				const promise = (async () => {
					const { result } = await skillsApi.list({ sessionId }, abort.signal);
					if (!result.ok) throw new Error(`skill.list failed: ${result.error?.code}: ${result.error?.message}`);
					return result.value.skills || [];
				})();
				const entry = {
					promise,
					abort,
					settled: void 0
				};
				fetches.set(sessionId, entry);
				promise.then((skills) => {
					entry.settled = skills;
					notifyLexicon(sessionId);
				}, () => {
					if (fetches.get(sessionId) === entry) fetches.delete(sessionId);
				});
				return promise;
			};
			const invalidate = (arg) => {
				const key = typeof arg === "string" ? arg : arg?.sessionId;
				if (!key) return;
				const entry = fetches.get(key);
				if (entry === void 0) return;
				fetches.delete(key);
				entry.abort.abort();
				notifyLexicon(key);
			};
			const clearAll = () => {
				for (const key of Array.from(fetches.keys())) invalidate(key);
			};
			const source = {
				trigger: "/",
				name: "skill-enhanced",
				order: 1.5,
				async candidates(session, { query, signal }) {
					const sessionId = session?.sessionId;
					if (!sessionId) return [];
					let skills;
					try {
						skills = await fetchCatalog(sessionId);
					} catch {
						return [];
					}
					if (signal.aborted) return [];
					const currentText = typeof session?.draft?.text === "string" ? session.draft.text : typeof session?.text === "string" ? session.text : "";
					const pickedSkillNames = new Set(Array.from(currentText.matchAll(/\/([a-zA-Z0-9_-]+)\s+/g)).map((m) => m[1]));
					const matched = skills.map((skill) => {
						const res = fuzzyMatchSkill(skill, query);
						if (!res) return null;
						const isAlreadyPicked = pickedSkillNames.has(skill.name);
						return {
							...res,
							score: isAlreadyPicked ? res.score - 500 : res.score
						};
					}).filter((item) => item !== null).sort((a, b) => b.score - a.score);
					const sectionTitle = t("menu.section");
					return matched.map(({ item }) => ({
						name: item.name,
						section: sectionTitle,
						description: item.modelInvocable ? item.description : `${t("menu.userOnly")} · ${item.description}`
					}));
				},
				warm(session) {
					const sessionId = session?.sessionId;
					if (sessionId) fetchCatalog(sessionId).catch(() => {});
				},
				lexicon(session) {
					const sessionId = session?.sessionId;
					return sessionId ? fetches.get(sessionId)?.settled?.map((s) => s.name) : void 0;
				},
				subscribeLexicon(session, listener) {
					const key = session?.sessionId;
					if (!key) return () => {};
					const listeners = lexiconListeners.get(key) ?? /* @__PURE__ */ new Set();
					listeners.add(listener);
					lexiconListeners.set(key, listeners);
					return () => {
						listeners.delete(listener);
						if (listeners.size === 0) lexiconListeners.delete(key);
					};
				},
				onPick({ candidate }) {
					return { text: `/${candidate.name} ` };
				}
			};
			ctx.effect(() => {
				const offPreset = ctx.remote?.$on?.("agent-preset/selected", invalidate);
				const offReset = ctx.on?.("connection/reset", clearAll);
				const unregisterSource = inputTriggers.registerSource(source);
				return () => {
					if (typeof offPreset === "function") offPreset();
					if (typeof offReset === "function") offReset();
					unregisterSource?.();
					clearAll();
				};
			}, "ui-skill-enhanced: source");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
