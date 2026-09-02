import { fuzzyMatchSkill } from "./fuzzy.js";
import { NS, zh, en } from "./locales.js";
export const inject = [
    "inputTriggers",
    "connection",
    "sessions",
    "locale",
    "remote",
];
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-skill-enhanced: i18n");
    const skillsApi = ctx.get("connection").api.skills;
    const sessions = ctx.get("sessions");
    const inputTriggers = ctx.get("inputTriggers");
    const t = ctx.locale.bind(NS);
    const fetches = new Map();
    const lexiconListeners = new Map();
    const notifyLexicon = (sessionId) => {
        const set = lexiconListeners.get(sessionId);
        if (!set)
            return;
        for (const listener of Array.from(set)) {
            try {
                listener();
            }
            catch (err) {
                console.error("[ui-skill-enhanced] lexicon listener error:", err);
            }
        }
    };
    const fetchCatalog = (sessionId) => {
        if (sessions.subagentAddress?.(sessionId) !== undefined) {
            return Promise.resolve([]);
        }
        const existing = fetches.get(sessionId);
        if (existing !== undefined)
            return existing.promise;
        const abort = new AbortController();
        const promise = (async () => {
            const { result } = await skillsApi.list({ sessionId }, abort.signal);
            if (!result.ok) {
                throw new Error(`skill.list failed: ${result.error?.code}: ${result.error?.message}`);
            }
            return (result.value.skills || []);
        })();
        const entry = { promise, abort, settled: undefined };
        fetches.set(sessionId, entry);
        promise.then((skills) => {
            entry.settled = skills;
            notifyLexicon(sessionId);
        }, () => {
            if (fetches.get(sessionId) === entry)
                fetches.delete(sessionId);
        });
        return promise;
    };
    const invalidate = (key) => {
        const entry = fetches.get(key);
        if (entry === undefined)
            return;
        fetches.delete(key);
        entry.abort.abort();
        notifyLexicon(key);
    };
    const clearAll = () => {
        for (const key of Array.from(fetches.keys()))
            invalidate(key);
    };
    const source = {
        trigger: "/",
        name: "skill-enhanced",
        order: 1.5, // Priority over native skill source (order: 2)
        async candidates(session, { query, signal }) {
            const skills = await fetchCatalog(session.sessionId);
            if (signal.aborted)
                return [];
            const matched = skills
                .map((skill) => fuzzyMatchSkill(skill, query))
                .filter((item) => item !== null)
                .sort((a, b) => b.score - a.score);
            return matched.map(({ item }) => ({
                name: item.name,
                description: item.modelInvocable
                    ? item.description
                    : `${t("menu.userOnly")} · ${item.description}`,
            }));
        },
        warm(session) {
            fetchCatalog(session.sessionId).catch(() => { });
        },
        lexicon(session) {
            return fetches.get(session.sessionId)?.settled?.map((s) => s.name);
        },
        subscribeLexicon(session, listener) {
            const key = session.sessionId;
            const listeners = lexiconListeners.get(key) ?? new Set();
            listeners.add(listener);
            lexiconListeners.set(key, listeners);
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0)
                    lexiconListeners.delete(key);
            };
        },
        onPick({ candidate }) {
            // Pick one skill, insert trailing space for seamless chained typing of subsequent /<skill>
            return { text: `/${candidate.name} ` };
        },
    };
    ctx.remote?.$on?.("agent-preset/selected", invalidate);
    ctx.on?.("connection/reset", clearAll);
    ctx.effect(() => {
        const unregister = inputTriggers.registerSource(source);
        return () => {
            unregister?.();
            clearAll();
        };
    }, "ui-skill-enhanced: source");
}
//# sourceMappingURL=index.js.map