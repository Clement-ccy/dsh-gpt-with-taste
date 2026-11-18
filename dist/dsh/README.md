# GPT with Taste for DeepSeek Harness

Adds a taste-and-judgment behavior layer to every DeepSeek Harness session, and steers each turn with a short, role-appropriate instruction.

## What it installs

Two things, both scoped to the sessions you open after installing:

- **A behavior section** (`gpt-with-taste:behavior`) in the system prompt. Root sessions receive the `main` text, sub-agent sessions receive the `sub` text.
- **A pre-step steer.** Before every user turn, sub-agent turn, or agent/team/sub-agent message, the bundle inserts one instruction message ahead of the real message, choosing `userSteer`, `subSteer` or `agentSteer` by the role and the message source.

Nothing else changes: no tools are added, no messages are rewritten, and the injected instruction carries the plugin's own source kind (`gpt-with-taste`) so sessions stay readable in the log.

## Install

In DeepSeek Harness, open **Plugins → Discover**, add this index source, then install the entry:

```
https://raw.githubusercontent.com/Sentryea/dsh-gpt-with-taste/main/dist/dsh/index.json
```

The index names the GitHub commit that carries this package, so the host clones that exact revision and installs `dist/dsh` from it. The index file lives in the same repository, so it always describes the commit it points at.

## Requirements

- DeepSeek Harness 0.2.x — this build targets the v4 session format and was verified against 0.2.2-rc.3
- Node.js `^22.19.0 || >=24.0.0`
- Git, so the host can clone the pinned commit

## Package contents

| File | Purpose |
| --- | --- |
| `index.mjs` | The bundle entry: system-prompt section and pre-step steer |
| `texts.json` | The six behavior texts (`main`, `sub`, `independent`, `userSteer`, `subSteer`, `agentSteer`) |
| `cordis.patch.yml` | The bundle patch that registers the plugin in a profile |
| `index.json` | The plugin market index (format 1) that lists this package |
| `README.md` | This page |
| `LICENSE` | MIT |

## Upstream

The behavior recipe comes from [NB-Corp/gpt-with-taste](https://github.com/NB-Corp/gpt-with-taste), the upstream project, with the DeepSeek Harness 0.2.x compatibility fixes (session format v4 source kind, current message source kinds, widened peer range). The recipe lives in `recipe/` upstream and is compiled per harness; this repository carries the compiled DSH bundle and the market index.

## 中文说明

**它做什么**：为每个 DSH 会话注入一段「品味与判断力」的行为层系统提示，并在用户回合、子代理回合、以及 agent/team/子代理消息进入模型之前，插入一条按角色挑选的引导指令。不增加工具、不改写原消息，注入消息带有插件自己的 source kind（`gpt-with-taste`），会话日志里能直接看出是插件插的。

**怎么装**：在 DeepSeek Harness 里打开 **插件 → 发现**，把下面这个索引源加进去，再搜索安装条目：

```
https://raw.githubusercontent.com/Sentryea/dsh-gpt-with-taste/main/dist/dsh/index.json
```

索引里写明了携带这个包的 GitHub 提交，宿主会克隆那个提交并从其中安装 `dist/dsh`。索引文件就在同一个仓库里，所以它永远描述自己指向的那个提交。

**环境要求**：DeepSeek Harness 0.2.x（本版本面向会话格式 v4，实测 0.2.2-rc.3），Node.js `^22.19.0 || >=24.0.0`，以及 Git（宿主要克隆被固定的提交）。

**来源**：行为配方来自上游 [NB-Corp/gpt-with-taste](https://github.com/NB-Corp/gpt-with-taste)，本仓库带着 DeepSeek Harness 0.2.x 的兼容修复，并承载编译好的 DSH bundle 与市场索引。

## License

MIT
