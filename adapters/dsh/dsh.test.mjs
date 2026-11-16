import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {render} from './build.mjs';
import {loadRecipe} from '../../src/build.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const recipe = await loadRecipe(root);
const outputs = await render({root, ...recipe});

// The bundle only needs createUserMessage from the host SDK; a local stub keeps
// this fixture runnable without an installed DSH host.
const STUB = "export function createUserMessage({content, source}) { return {role: 'user', id: 'stub-' + source.kind, content, source}; }";

async function loadBundle(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gpt-with-taste-dsh-'));
  t.after(() => fs.rm(dir, {recursive: true, force: true}));
  for (const [file, bytes] of outputs) await fs.writeFile(path.join(dir, file), bytes);
  const stubDir = path.join(dir, 'node_modules', '@deepseek-ai', 'dsh-llm');
  await fs.mkdir(stubDir, {recursive: true});
  await fs.writeFile(path.join(stubDir, 'package.json'), JSON.stringify({name: '@deepseek-ai/dsh-llm', version: '0.0.0', main: 'index.js', type: 'module'}));
  await fs.writeFile(path.join(stubDir, 'index.js'), STUB);
  const mod = await import(pathToFileURL(path.join(dir, 'index.mjs')).href);
  const texts = JSON.parse(await fs.readFile(path.join(dir, 'texts.json'), 'utf8'));
  return {mod, texts};
}

function harness(mod) {
  const sections = [];
  const listeners = new Map();
  const ctx = {
    systemPrompt: {section(section) { sections.push(section); }},
    on(event, handler) { listeners.set(event, handler); },
  };
  return {ctx, sections, listeners};
}

const agentMain = {session: {header: {origin: undefined}}};
const agentSub = {session: {header: {origin: 'subagent'}}};
const message = kind => ({role: 'user', id: 'm-' + kind, content: [{type: 'text', text: 'payload'}], source: {kind}});

test('registers one behavior section for the configured root role', async t => {
  const {mod, texts} = await loadBundle(t);
  const h = harness(mod);
  await mod.apply(h.ctx, {rootRole: 'main'});
  assert.equal(h.sections.length, 1);
  const section = h.sections[0];
  assert.equal(section.name, 'gpt-with-taste:behavior');
  assert.equal(section.order, 10);
  assert.equal(section.text({agent: agentMain}), texts.main);
  assert.equal(section.text({agent: agentSub}), texts.sub);
  assert.equal(section.text({agent: undefined}), '');
});

test('rejects an unknown root role', async t => {
  const {mod} = await loadBundle(t);
  const h = harness(mod);
  await assert.rejects(() => mod.apply(h.ctx, {rootRole: 'root'}), /rootRole/);
});

test('injects the matching steer text before every steerable source', async t => {
  const {mod, texts} = await loadBundle(t);
  const h = harness(mod);
  await mod.apply(h.ctx, {rootRole: 'main'});
  const handler = h.listeners.get('agent/pre-step');
  assert.ok(handler, 'the bundle subscribes to agent/pre-step');

  const run = async (agent, kind) => {
    const original = message(kind);
    const decision = await handler({agent, messages: [original], turn: 1, step: 1, signal: new AbortController().signal}, async () => ({kind: 'enter', messages: [original]}));
    return {decision, original};
  };

  const userSteer = await run(agentMain, 'user');
  assert.equal(userSteer.decision.messages.length, 2);
  assert.equal(userSteer.decision.messages[0].source.kind, 'gpt-with-taste');
  assert.equal(userSteer.decision.messages[0].source.form, 'instructions');
  assert.equal(userSteer.decision.messages[0].content[0].text, texts.userSteer);
  assert.equal(userSteer.decision.messages[1], userSteer.original);

  const userSub = await run(agentSub, 'user');
  assert.equal(userSub.decision.messages[0].content[0].text, texts.subSteer);

  for (const kind of ['agent-message', 'team-message', 'subagent-report', 'subagent-settled']) {
    const main = await run(agentMain, kind);
    assert.equal(main.decision.messages[0].content[0].text, texts.agentSteer, kind);
    const sub = await run(agentSub, kind);
    assert.equal(sub.decision.messages[0].content[0].text, texts.subSteer, kind);
  }

  const coordinatorSub = await run(agentSub, 'coordinator');
  assert.equal(coordinatorSub.decision.messages[0].content[0].text, texts.subSteer);
  const coordinatorMain = await run(agentMain, 'coordinator');
  assert.equal(coordinatorMain.decision.messages.length, 1);
});

test('leaves unrelated sources untouched', async t => {
  const {mod} = await loadBundle(t);
  const h = harness(mod);
  await mod.apply(h.ctx, {rootRole: 'main'});
  const handler = h.listeners.get('agent/pre-step');
  const original = message('runtime-context');
  const decision = await handler({agent: agentMain, messages: [original], turn: 1, step: 1, signal: new AbortController().signal}, async () => ({kind: 'enter', messages: [original]}));
  assert.deepEqual(decision.messages, [original]);
});

test('passes a rejected decision through unchanged', async t => {
  const {mod} = await loadBundle(t);
  const h = harness(mod);
  await mod.apply(h.ctx, {rootRole: 'main'});
  const handler = h.listeners.get('agent/pre-step');
  const rejected = {kind: 'reject', reason: 'busy'};
  const decision = await handler({agent: agentMain, messages: [], turn: 1, step: 1, signal: new AbortController().signal}, async () => rejected);
  assert.equal(decision, rejected);
});

test('uses a producer-owned source kind accepted by session format v4', async t => {
  const packageRoot = process.env.DSH_PACKAGE_ROOT;
  if (!packageRoot) {
    t.skip('set DSH_PACKAGE_ROOT to check the v4 admission rules');
    return;
  }
  const requireDsh = createRequire(path.join(packageRoot, 'package.json'));
  const {releasedV4SessionFormatCodec} = await import(pathToFileURL(requireDsh.resolve('@deepseek-ai/dsh-session-format-v3-to-v4')).href);
  const encode = kind => releasedV4SessionFormatCodec.encodeEvent({
    type: 'user/message',
    data: {role: 'user', id: 'm-' + kind, content: [{type: 'text', text: 'hi'}], source: {kind, form: 'instructions'}},
    surfaceOp: 'append',
  });
  assert.ok(encode('gpt-with-taste'));
  assert.throws(() => encode('plugin'), /producer-owned source kind/);
});

test('publishes a market index the host parser accepts', async t => {
  const packageRoot = process.env.DSH_PACKAGE_ROOT;
  if (!packageRoot) {
    t.skip('set DSH_PACKAGE_ROOT to check the market index');
    return;
  }
  const requireDsh = createRequire(path.join(packageRoot, 'package.json'));
  let parseMarketIndex, marketInstallTarget;
  try {
    const resolved = requireDsh.resolve('@deepseek-ai/dsh-plugin-market-index');
    ({parseMarketIndex, marketInstallTarget} = await import(pathToFileURL(resolved).href));
  } catch {
    t.skip('the host installation has no plugin market index parser');
    return;
  }
  const index = JSON.parse(outputs.get('index.json'));
  const manifest = JSON.parse(outputs.get('package.json'));
  const parsed = parseMarketIndex(index, 'https://raw.githubusercontent.com/Clement-ccy/dsh-gpt-with-taste/main/dist/dsh/index.json');
  assert.equal(parsed.plugins.length, 1);
  const plugin = parsed.plugins[0];
  assert.equal(plugin.name, manifest.name);
  assert.equal(plugin.versions.length, 1);
  assert.equal(plugin.versions[0].version, manifest.version);
  const target = marketInstallTarget(plugin.name, plugin.versions[0]);
  assert.match(target.spec, /^git\+https:\/\/github\.com\/Clement-ccy\/dsh-gpt-with-taste\.git#[0-9a-f]{40}&path:\/dist\/dsh$/);
});
