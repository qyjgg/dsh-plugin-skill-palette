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

  const invalidate = (arg: string | { sessionId?: string } | undefined) => {
    const key = typeof arg === "string" ? arg : arg?.sessionId;
    if (!key) return;
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
      const sessionId = session?.sessionId;
      if (!sessionId) return [];

      let skills: SkillDescriptor[];
      try {
        skills = await fetchCatalog(sessionId);
      } catch {
        return [];
      }
      if (signal.aborted) return [];

      const currentText =
        typeof session?.draft?.text === "string"
          ? session.draft.text
          : typeof session?.text === "string"
          ? session.text
          : "";
      const pickedSkillNames = new Set(
        Array.from(currentText.matchAll(/\/([a-zA-Z0-9_-]+)\s+/g)).map((m: any) => m[1])
      );

      const matched = skills
        .map((skill) => {
          const res = fuzzyMatchSkill(skill, query);
          if (!res) return null;
          const isAlreadyPicked = pickedSkillNames.has(skill.name);
          return {
            ...res,
            score: isAlreadyPicked ? res.score - 500 : res.score,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.score - a.score);

      const sectionTitle = t("menu.section");
      return matched.map(({ item }) => ({
        name: item.name,
        section: sectionTitle,
        description: item.modelInvocable
          ? item.description
          : `${t("menu.userOnly")} · ${item.description}`,
      }));
    },
    warm(session: any) {
      const sessionId = session?.sessionId;
      if (sessionId) {
        fetchCatalog(sessionId).catch(() => {});
      }
    },
    lexicon(session: any) {
      const sessionId = session?.sessionId;
      return sessionId ? fetches.get(sessionId)?.settled?.map((s) => s.name) : undefined;
    },
    subscribeLexicon(session: any, listener: () => void) {
      const key = session?.sessionId;
      if (!key) return () => {};
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
