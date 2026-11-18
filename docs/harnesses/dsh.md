# DeepSeek Harness

Use GPT with Taste as a native [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) profile bundle. It adds behavioral guidance to the host prompt and places source-specific steering immediately before incoming user or subagent messages. It needs no Kiki installation or `dsh-kiki-recipe` plugin.

## Install and enable

Use DSH **0.2.x** with its normal profile plugin support. This build targets the v4 session format and has been verified against 0.2.2-rc.3; rerun the consumer fixture below when adopting another prerelease. Keep your existing profile, provider, model, permission settings and agent presets.

From this repository's root, build the generated package and add it to the profile you use. This example uses `web`:

```sh
node scripts/build.mjs --target dsh
dsh plugin --profile web add ./dist/dsh
```

`dsh plugin` uses pnpm to install the local package into that profile. Its native bundle discovery adds `dsh-gpt-with-taste` to `dsh.profile.bundles`. The bundle's `cordis.patch.yml` inserts one plugin row, `gpt-with-taste`; the next process launched with that profile loads it. Repeat the add command for another profile only if you want the guidance there too. A running process keeps its current plugin generation.

The generated package imports the host's `@deepseek-ai/dsh-llm` peer for `createUserMessage`; use the DSH profile installer so it shares the host SDK. Do not install a separate Cordis runtime into the bundle.

## Install from the plugin market

This repository carries the compiled bundle and the plugin market index (format 1), so one GitHub repository serves both the install and the index source URL:

```
https://raw.githubusercontent.com/Sentryea/dsh-gpt-with-taste/main/dist/dsh/index.json
```

In DSH, open **Plugins → Discover**, add that URL as an index source, search for *GPT with Taste*, and install the entry. The host clones the commit the index pins and installs `dist/dsh` from it into the current profile, the same way `dsh plugin --profile web add` installs a local package. The host checks its own version against the package's `@deepseek-ai/dsh-*` peer range; this package requires `>=0.1.0-rc.6 <1.0.0`.

`adapters/dsh/market-index.json` is the index source and is copied into the package as `index.json`; `adapters/dsh/README.md` is the page the market shows. The build fails when the index does not name the version it produces or a commit that carries the package.

To release a new version:

1. Bump `recipe/manifest.json` and list the new version in `adapters/dsh/market-index.json`.
2. Build, commit and push. That commit carries the new bundle.
3. Point the index at it, then rebuild and commit again. The index names the previous commit, because a commit cannot contain its own hash.

## Choose the root role

The default root role is **Main**. A native delegated agent is **Subagent**, selected by `agent.session.header.origin === 'subagent'`. An unrelated root session is not treated as a subagent.

For an **Independent** root, add this row to the selected profile's own `cordis.patch.yml` (under the resolved DSH home, `profiles/<profile>/cordis.patch.yml`):

```yaml
- id: gpt-with-taste
  config:
    rootRole: independent
```

Independent roots get the Independent system guidance and no automatic steering. Their native delegated children still get Subagent guidance. Change `independent` to `main` to restore Main behavior. DSH config patches replace the row's whole config; `rootRole` is this plugin's only option.

The profile bundle applies across the profile's existing presets without replacing them. A custom native composition may instead register `dsh-gpt-with-taste` in its agent preset or through `agent.ctx.plugin(...)`, with the same config. Install it at one level only; a preset-local registration applies only to sessions joined to that preset.

## What reaches the model

The plugin contributes the named system section `gpt-with-taste:behavior` at order `10`, after the deployment persona. It does not use `complete: true`, replace the persona, or copy environment and AGENTS content. Host sections, dynamic context and tool schemas retain their original providers. If your composition deliberately supplies a complete system-prompt section, DSH gives that complete section precedence over augmentations, including this one.

At `agent/pre-step`, the plugin delegates with `next()` and augments only an accepted `enter` decision:

| Native message source | Guidance before that message |
| --- | --- |
| `user` to a Main root | User Steer |
| `user` or `coordinator` to a native subagent | Sub Steer |
| `agent-message`, `team-message`, `subagent-report` or `subagent-settled` to a Main root | Agent Steer |
| `agent-message`, `team-message`, `subagent-report` or `subagent-settled` to a native subagent | Sub Steer |
| Tool results, plugin context, unknown source kinds | None |

Each recognized message gets one preceding plugin-owned instruction message. The original message keeps its identity, content and source. DSH logs both through its normal `user/message` path before a request. A rejected step stays rejected. An ordinary tool continuation with no new recognized input gets no new steering.

The plugin neither sends nor injects inbox items, so it cannot wake an idle agent or start an extra turn. Quiet reports remain quiet until the host claims them; running-agent delivery retains the host's next-step/next-turn behavior. It does not infer completion from a report's prose or attribute an unknown/plugin source to an agent. Synchronous subagent results delivered as ordinary tool results remain tool results.

Models, providers, reasoning effort, tool access, delegation limits, leaf roles and write permissions remain host-owned.

## Disable or remove

To disable guidance while keeping the package, add this row to the profile's `cordis.patch.yml`, then use a newly launched process:

```yaml
- id: gpt-with-taste
  disabled: true
```

Remove the disabling row to enable it again. If the profile also has a role override, keep that config in the remaining row.

To uninstall from the example profile:

```sh
dsh plugin --profile web remove dsh-gpt-with-taste
```

Remove any `gpt-with-taste` override row from the profile's patch file as well. The native installer removes the package's bundle entry. The next process uses the original host prompt and message handling; no persona or preset files need restoration. Already logged instructions remain part of existing session history.

## Build and verify without a model

`recipe/` is the editable behavior source. `adapters/dsh/build.mjs` implements `render({root, meta, texts})` and emits `dist/dsh/package.json`, `cordis.patch.yml`, `index.mjs`, `texts.json`, the market index `index.json`, the package page `README.md` and the MIT `LICENSE`. The runtime reads only generated text. Edit the recipe and rebuild rather than editing `dist/dsh`.

```sh
node scripts/build.mjs --target dsh
node scripts/build.mjs --target dsh --check
```

The consumer fixture needs an existing DSH installation and Node 22.19+ or 24+. For a global npm installation, run in PowerShell:

```powershell
$env:DSH_PACKAGE_ROOT = Join-Path (npm root -g) '@deepseek-ai/dsh'
node --test adapters/dsh/dsh.test.mjs
```

Or in a POSIX shell:

```sh
DSH_PACKAGE_ROOT="$(npm root -g)/@deepseek-ai/dsh" node --test adapters/dsh/dsh.test.mjs
```

For another installation layout, set `DSH_PACKAGE_ROOT` to the directory containing that installation's `@deepseek-ai/dsh/package.json`. The fixture creates a temporary profile under this repository's `.tmp/`, discovers the bundle with DSH's `loadProfile`, and applies it through the real Cordis Loader. It exercises prompt assembly, scoped installation, source routing, disposal and the real inbox/claim/pre-step/session-log path. It stops the loop at `agent/request` before provider resolution, with no model call or live-home access. It uses DSH's own profile module-link setup to resolve the peer from the selected installation.

The target APIs are the rc.6 `AssembleContext.agent`, `Session.header.origin`, `agent/pre-step` decision and identified `UserMessage` types. Source inspection through `dsh-v0.1.1-rc.2` found the same seams; that later loop changes interrupted-stream handling, which this adapter does not intercept. Runtime verification for another prerelease is the same fixture pointed at that installation, not an assumption based on the source checkout.

Native references: [bundle discovery and profile layers](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.1-rc.2/packages/boot/app-boot/src/profile.ts), [system-prompt sections and assembly](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.1-rc.2/packages/core/system-prompt/src/index.ts), [agent events and input types](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.1-rc.2/packages/core/agent/src/runtime-types.ts), [native subagent message sources](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.1-rc.2/packages/subagent/subagent/src/continuation.ts). DeepSeek Harness is MIT-licensed.
