# dsh-plugin-skill-palette

English | [简体中文](README.zh.md)

⚡ **DeepSeek Harness (DSH) Enhanced Skill Plugin**: Tiered weighted fuzzy search for `/` commands and seamless multi-skill inline selection.

---

## 🎯 Key Problems Solved

1. **Native `/` Skill Trigger Lacks Fuzzy Search**:
   - DSH native skill matching only supports `startsWith` prefix filtering. Typing `/review` fails to match `code-review`, and typing `/test` cannot find `tdd` by description keywords.
   - **Solution**: Built-in **4-tier weighted fuzzy matching engine** (Exact prefix > Subsequence & word boundaries > Description full-text keywords > Subsequence fuzzy).

2. **Chained Multi-Skill Selection**:
   - Complex development tasks require combining multiple skills (e.g. `Caveman` terse style + `TDD` test-first cycle + `Code Review` standards).
   - **Solution**: Picking a skill inserts `/<skill> ` and preserves input focus. Typing `/` immediately opens fuzzy search for the next skill, enabling rapid multi-skill composition like `/caveman /tdd /code-review `.

---

## 📦 Installation & Setup

### Option 1: Install via DSH CLI (Recommended)

```bash
dsh plugin --profile web add dsh-plugin-skill-palette
```

### Option 2: Local Development & Build

```bash
cd dsh-plugin-skill-palette
npm install
npm run build
```

Then configure in `package.json` of your profile:
```json
{
  "dependencies": {
    "dsh-plugin-skill-palette": "file:E:/work/dsh-plugin-skill-palette"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "...",
        "dsh-plugin-skill-palette"
      ]
    }
  }
}
```

### Uninstallation

```bash
dsh plugin --profile web remove dsh-plugin-skill-palette
```
If configured locally, simply remove `dsh-plugin-skill-palette` from `dependencies` and `bundles` in your profile's `package.json`.

---

## 🖥️ Features

### 1. Tiered Weighted Fuzzy Search
Type `/` after any whitespace in composer:
- `/cr` or `/review` matches `code-review` and `caveman-review`
- `/test` matches `tdd` (via description)
- `/git` matches `git-guardrails-claude-code` and `caveman-commit`

### 2. Seamless Inline Multi-Skill Chaining
- Pick a skill from dropdown menu via Enter or mouse click;
- Trailing space is auto-appended; type `/` again to immediately pick the second skill;
- On submission, DSH host pre-step hook extracts all `/name` tokens and injects `<skill_content>` for every selected skill.

---

## 📄 License

[MIT License](LICENSE)
