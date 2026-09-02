# 🚀 Awesome DSH Plugin 投稿指南与 PR 模板

根据 [awesome-dsh-plugin 官方贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)，README 由脚本自动生成，投稿时**只需在 `data/plugins/` 目录下新增一个 YAML 文件**并提交 Pull Request 即可。

---

## 📋 1. 前置准备与要求检查

在提交 PR 前，请确保目标仓库满足以下 CI 自动审查条件：
- [x] **已声明 `dsh.bundle`**：`package.json` 包含 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，且根目录存在 `cordis.patch.yml`（已配置完毕）。
- [x] **添加 GitHub Topic**：在你的 GitHub 仓库主页右侧添加 `dsh-plugin` topic。
- [ ] **仓库年龄与提交数**：仓库创建满 **1 天**，且 commit 记录 **≥ 10 次**。
- [x] **真实可用代码**：非占位空壳，支持 `pnpm run build` 成功构建。

---

## 📄 2. 编写投稿 YAML 文件

Fork 官方仓库 `awesome-dsh-plugin/awesome-dsh-plugin` 后，在 `data/plugins/` 下新建以下文件：

**文件路径**：`data/plugins/qyjgg__dsh-plugin-skill-palette.yml`

**文件内容**：
```yaml
url: https://github.com/qyjgg/dsh-plugin-skill-palette
name: qyjgg/dsh-plugin-skill-palette
category: skill
description:
  en: 'Enhanced skill plugin for DeepSeek Harness: Tiered fuzzy slash search and seamless multi-skill inline selection.'
  zh: 'DeepSeek Harness 增强技能插件：提供 / 分层模糊搜索与流畅的多技能连续选择体验。'
```

---

## 🔀 3. 提交 Pull Request

### PR 标题：
```text
feat(plugins): add qyjgg/dsh-plugin-skill-palette
```

### PR 内容：
```markdown
### Submission Details
- **Repo**: https://github.com/qyjgg/dsh-plugin-skill-palette
- **Category**: `skill`
- **File added**: `data/plugins/qyjgg__dsh-plugin-skill-palette.yml`

### Checklist
- [x] Added `dsh-plugin` topic to the repository
- [x] `package.json` declares `dsh.bundle` and `cordis.patch.yml` exists
- [x] Repo has >= 10 commits and is > 1 day old
- [x] Followed `contributing.md` without modifying READMEs manually
```
