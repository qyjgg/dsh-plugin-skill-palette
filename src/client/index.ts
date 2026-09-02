import { fuzzyMatchSkill } from "./fuzzy.js";
import { NS, zh, en } from "./locales.js";

export interface SkillDescriptor {
  name: string;
  description: string;
  modelInvocable: boolean;
  userInvocable: boolean;
}

export const inject = [
  "inputTriggers",
  "connection",
  "sessions",
  "locale",
  "remote",
];

export function apply(ctx: any) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-skill-enhanced: i18n");

  const skillsApi = ctx.get("connection").api.skills;
  const sessions = ctx.get("sessions");
  const inputTriggers = ctx.get("inputTriggers");
  const t = ctx.locale.bind(NS);

  const fetches = new Map<string, {
    promise: Promise<SkillDescriptor[]>;
    abort: AbortController;
    settled?: SkillDescriptor[];
  }>();
  const lexiconListeners = new Map<string, Set<() => void>>();

  const notifyLexicon = (sessionId: string) => {
    const set = lexiconListeners.get(sessionId);
    if (!set) return;
    for (const listener of Array.from(set)) {
      try {
        listener();
      } catch (err) {
        console.error("[ui-skill-enhanced] lexicon listener error:", err);
      }
    }
  };

  const fetchCatalog = (sessionId: string): Promise<SkillDescriptor[]> => {
    if (sessions.subagentAddress?.(sessionId) !== undefined) {
      return Promise.resolve([]);
    }
    const existing = fetches.get(sessionId);
    if (existing !== undefined) return existing.promise;

    const abort = new AbortController();
    const promise = (async () => {
      const { result } = await skillsApi.list({ sessionId }, abort.signal);
      if (!result.ok) {
        throw new Error(`skill.list failed: ${result.error?.code}: ${result.error?.message}`);
      }
      return (result.value.skills || []) as SkillDescriptor[];
    })();

    const entry = { promise, abort, settled: undefined as SkillDescriptor[] | undefined };
    fetches.set(sessionId, entry);

    promise.then(
      (skills) => {
        entry.settled = skills;
        notifyLexicon(sessionId);
      },
      () => {
        if (fetches.get(sessionId) === entry) fetches.delete(sessionId);
      }
    );

    return promise;
  };

  const invalidate = (key: string) => {
    const entry = fetches.get(key);
    if (entry === undefined) return;
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
    order: 1.5, // Priority over native skill source (order: 2)
    async candidates(session: any, { query, signal }: { query: string; signal: AbortSignal }) {
      const skills = await fetchCatalog(session.sessionId);
      if (signal.aborted) return [];

      const matched = skills
        .map((skill) => fuzzyMatchSkill(skill, query))
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.score - a.score);

      return matched.map(({ item }) => ({
        name: item.name,
        description: item.modelInvocable
          ? item.description
          : `${t("menu.userOnly")} · ${item.description}`,
      }));
    },
    warm(session: any) {
      fetchCatalog(session.sessionId).catch(() => {});
    },
    lexicon(session: any) {
      return fetches.get(session.sessionId)?.settled?.map((s) => s.name);
    },
    subscribeLexicon(session: any, listener: () => void) {
      const key = session.sessionId;
      const listeners = lexiconListeners.get(key) ?? new Set();
      listeners.add(listener);
      lexiconListeners.set(key, listeners);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) lexiconListeners.delete(key);
      };
    },
    onPick({ candidate }: any) {
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
