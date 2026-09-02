# dsh-plugin-skill-palette

[English](README.md) | 简体中文

⚡ **DeepSeek Harness (DSH) 增强技能插件**：为 `/` 命令提供分层加权模糊搜索（名称前缀 / 子序列简拼 / 描述全文检索）与流畅的连续多技能链式选择。

---

## 🎯 解决的核心痛点

1. **原生 `/` 技能命令不支持模糊搜索**：
   - 原生 DSH 仅支持 `startsWith` 前缀匹配。输入 `/review` 无法匹配到 `code-review`，输入 `/test` 无法通过描述匹配到 `tdd`。
   - **本项目方案**：内置 **4 层加权模糊匹配算法**（名称前缀 > 词边界/子序列简拼 > 描述关键词全文 > 描述模糊）。

2. **不能便捷连续选择多个技能**：
   - 复杂场景需要多个技能协同（如：`Caveman` 极简压缩 + `TDD` 测试驱动 + `Code Review` 代码审查）。
   - **本项目方案**：单选技能后自动补齐空格并保持光标聚焦，敲击 `/` 即可立刻调出下一个技能的模糊搜索，连续选择多个技能无缝衔接。

---

## 📦 安装与配置

### 方式 1：通过 DSH 插件命令安装（推荐）

```bash
dsh plugin --profile web add dsh-plugin-skill-palette
```

### 方式 2：本地源码加载

1. 编译插件：
   ```bash
   cd dsh-plugin-skill-palette
   npm install
   npm run build
   ```

2. 在你的 DSH 配置文件（`C:\Users\<user>\.dsh\profiles\web\package.json`）中添加引用：
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

### 卸载插件

```bash
dsh plugin --profile web remove dsh-plugin-skill-palette
```
若使用本地引用，直接从 profile 配置文件的 `dependencies` 与 `bundles` 中删除 `dsh-plugin-skill-palette` 即可。

---

## 🖥️ 功能特性

### 1. 分层加权模糊检索 (Tiered Fuzzy Search)
在输入框任意空白后输入 `/`：
- 输入 `/cr` 或 `/review` 匹配 `code-review` 与 `caveman-review`
- 输入 `/test` 根据描述匹配 `tdd`（Test-driven development）
- 输入 `/git` 匹配 `git-guardrails-claude-code` 与 `caveman-commit`

### 2. 流畅的多技能连续选择 (Inline Multi-Skill Chaining)
- 键盘选择或鼠标点击任一技能后，输入框填入 `/skill1 `；
- 紧接着再次输入 `/`，下拉菜单即刻弹出，选择 `/skill2 `，轻松完成 `/caveman /tdd /code-review ` 多技能组合输入；
- 回车提交后，DSH 后端 Pre-step 拦截器会自动提取所有 `/name`，并将各自的 `<skill_content>` 依次注入上下文。

---

## 📄 开源协议

[MIT License](LICENSE)
