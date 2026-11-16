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
https://cdn.jsdelivr.net/npm/dsh-gpt-with-taste@0.1.0/index.json
```

The index is shipped inside the npm package, so the same URL always resolves to the manifest of the version it lists.

## Requirements

- DeepSeek Harness 0.2.x — this build targets the v4 session format and was verified against 0.2.2-rc.3
- Node.js `^22.19.0 || >=24.0.0`

## Package contents

| File | Purpose |
| --- | --- |
| `index.mjs` | The bundle entry: system-prompt section and pre-step steer |
| `texts.json` | The six behavior texts (`main`, `sub`, `independent`, `userSteer`, `subSteer`, `agentSteer`) |
| `cordis.patch.yml` | The bundle patch that registers the plugin in a profile |
| `index.json` | The plugin market index (format 1) that lists this package |
| `LICENSE` | MIT |

## Upstream

This package is built from [NB-Corp/gpt-with-taste](https://github.com/NB-Corp/gpt-with-taste), the upstream behavior recipe, with the DeepSeek Harness 0.2.x compatibility fixes (session format v4 source kind, current message source kinds, widened peer range). The recipe itself lives in `recipe/` upstream and is compiled per harness.

## 中文说明

**它做什么**：为每个 DSH 会话注入一段「品味与判断力」的行为层系统提示，并在用户回合、子代理回合、以及 agent/team/子代理消息进入模型之前，插入一条按角色挑选的引导指令。不增加工具、不改写原消息，注入消息带有插件自己的 source kind（`gpt-with-taste`），会话日志里能直接看出是插件插的。

**怎么装**：在 DeepSeek Harness 里打开 **插件 → 发现**，把下面这个索引源加进去，再搜索安装条目：

```
https://cdn.jsdelivr.net/npm/dsh-gpt-with-taste@0.1.0/index.json
```

索引文件随 npm 包一起发布，所以这个地址始终指向它声明的那个版本。

**环境要求**：DeepSeek Harness 0.2.x（本版本面向会话格式 v4，实测 0.2.2-rc.3），Node.js `^22.19.0 || >=24.0.0`。

**来源**：包由 [NB-Corp/gpt-with-taste](https://github.com/NB-Corp/gpt-with-taste) 编译而来，行为文本在上游 `recipe/` 里维护。

## License

MIT
