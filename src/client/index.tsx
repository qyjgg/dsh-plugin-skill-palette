import React from "react";
import ReactDOM from "react-dom";
import { fuzzyMatchSkill } from "./fuzzy";
import { NS, zh, en } from "./locales";
import { PaletteModal, SkillItem } from "./PaletteModal";

export const inject = [
  "inputTriggers",
  "connection",
  "sessions",
  "slots",
  "locale",
  "remote",
];

export function apply(ctx: any) {
  // 1. Register I18n dictionaries
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-skill-enhanced: i18n");
  const t = ctx.locale.bind(NS);

  const skillsApi = ctx.get("connection").api.skills;
  const sessions = ctx.get("sessions");
  const inputTriggers = ctx.get("inputTriggers");

  // State management
  let cachedCatalog: SkillItem[] = [];
  let isPaletteOpen = false;
  let activeSessionId = "";
  let modalContainer: HTMLDivElement | null = null;

  const getContainer = () => {
    if (!modalContainer) {
      modalContainer = document.createElement("div");
      modalContainer.id = "dsh-skill-palette-root";
      document.body.appendChild(modalContainer);
    }
    return modalContainer;
  };

  const renderModal = () => {
    const container = getContainer();
    ReactDOM.render(
      <PaletteModal
        skills={cachedCatalog}
        isOpen={isPaletteOpen}
        onClose={() => {
          isPaletteOpen = false;
          renderModal();
        }}
        onApply={(selectedNames) => {
          isPaletteOpen = false;
          renderModal();
          if (selectedNames.length > 0) {
            // Build consecutive skill tokens: /skill1 /skill2 ...
            const tokens = selectedNames.map((n) => `/${n}`).join(" ") + " ";
            
            // Dispatch to DSH Input Controller
            const controller = inputTriggers.sessionOf?.(activeSessionId);
            if (controller && typeof controller.execute === "function") {
              controller.execute({ text: tokens }, { start: 0, end: 0, draftRev: 0 });
            } else {
              // Fallback to DOM input insertion
              const textarea = document.querySelector<HTMLTextAreaElement>(
                "textarea[data-dsh-composer], textarea.composer-textarea, textarea"
              );
              if (textarea) {
                const start = textarea.selectionStart ?? textarea.value.length;
                const end = textarea.selectionEnd ?? textarea.value.length;
                const prevVal = textarea.value;
                textarea.value = prevVal.slice(0, start) + tokens + prevVal.slice(end);
                textarea.selectionStart = textarea.selectionEnd = start + tokens.length;
                textarea.dispatchEvent(new Event("input", { bubbles: true }));
                textarea.focus();
              }
            }
          }
        }}
        t={t}
      />,
      container
    );
  };

  const openPalette = (sessionId: string) => {
    activeSessionId = sessionId;
    isPaletteOpen = true;
    renderModal();
  };

  const fetchCatalog = async (sessionId: string): Promise<SkillItem[]> => {
    if (sessions.subagentAddress?.(sessionId) !== undefined) return [];
    try {
      const { result } = await skillsApi.list({ sessionId });
      if (result && result.ok) {
        cachedCatalog = result.value.skills;
        return cachedCatalog;
      }
    } catch (e) {
      console.error("[ui-skill-enhanced] fetch skills failed:", e);
    }
    return cachedCatalog;
  };

  // Listen for /skills or /use command executions
  ctx.remote?.$on?.("command/executed", (sessionId: string, name: string) => {
    if (name === "skills" || name === "use") {
      openPalette(sessionId);
    }
  });

  // Register Enhanced `/` Trigger Source with Tiered Fuzzy Match & Top-level Palette Opener
  const enhancedSource = {
    trigger: "/",
    name: "skill-enhanced",
    order: 1.5, // Placed before native skill source (order: 2)
    async candidates(session: any, { query, signal }: { query: string; signal: AbortSignal }) {
      const skills = await fetchCatalog(session.sessionId);
      if (signal.aborted) return [];

      const results: any[] = [];
      const q = query.trim().toLowerCase();

      // Top action item: Open Multi-select Skill Palette
      results.push({
        name: t("menu.openPalette"),
        description: t("palette.title"),
        isPaletteTrigger: true,
      });

      // Match /skills and /use shortcuts
      if (q && "skills".startsWith(q)) {
        results.push({
          name: "skills",
          description: `${t("palette.title")} (/skills)`,
          isPaletteTrigger: true,
        });
      }
      if (q && "use".startsWith(q)) {
        results.push({
          name: "use",
          description: `${t("palette.title")} (/use)`,
          isPaletteTrigger: true,
        });
      }

      // Tiered fuzzy matching for skills
      const matched = skills
        .map((skill) => fuzzyMatchSkill(skill, query))
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.score - a.score);

      for (const { item, nameHighlights, descHighlights } of matched) {
        results.push({
          name: item.name,
          description: item.modelInvocable
            ? item.description
            : `${t("menu.userOnly")} · ${item.description}`,
          originalSkill: item,
        });
      }

      return results;
    },
    warm(session: any) {
      fetchCatalog(session.sessionId).catch(() => {});
    },
    lexicon(session: any) {
      return ["skills", "use", ...cachedCatalog.map((s) => s.name)];
    },
    onPick({ candidate, session }: any) {
      if (candidate.isPaletteTrigger || candidate.name === "skills" || candidate.name === "use") {
        openPalette(session.sessionId);
        return { text: "" };
      }
      // Single skill selection: insert /skill and a trailing space to facilitate chained /skill typing
      return { text: `/${candidate.name} ` };
    },
  };

  ctx.effect(() => {
    const unregister = inputTriggers.registerSource(enhancedSource);
    return () => {
      unregister?.();
      if (modalContainer) {
        ReactDOM.unmountComponentAtNode(modalContainer);
        modalContainer.remove();
        modalContainer = null;
      }
    };
  }, "ui-skill-enhanced: source");
}
