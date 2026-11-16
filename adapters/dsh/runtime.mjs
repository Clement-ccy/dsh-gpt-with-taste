import {readFile} from 'node:fs/promises';
import {createUserMessage} from '@deepseek-ai/dsh-llm';

export const name = 'gpt-with-taste';
export const inject = ['systemPrompt', 'agents'];
const sectionName = 'gpt-with-taste:behavior';
// Session format v4 refuses the retired generic 'plugin' source kind, so this
// bundle owns its producer kind like every other first-party producer.
const sourceKind = 'gpt-with-taste';

/** Native DSH augmentation. All behavior text comes from the compiler output. */
export async function apply(ctx, config = {}) {
  const rootRole = config.rootRole ?? 'main';
  if (!['main', 'independent'].includes(rootRole)) {
    throw new Error('gpt-with-taste rootRole must be main or independent');
  }
  const texts = JSON.parse(await readFile(new URL('./texts.json', import.meta.url), 'utf8'));
  const roleOf = agent => agent.session.header.origin === 'subagent' ? 'sub' : rootRole;

  ctx.systemPrompt.section({
    name: sectionName,
    order: 10,
    text: ({agent}) => agent === undefined ? '' : texts[roleOf(agent)],
  });

  ctx.on('agent/pre-step', async ({agent}, next) => {
    const decision = await next();
    if (decision.kind !== 'enter') return decision;
    const role = roleOf(agent);
    return {
      ...decision,
      messages: decision.messages.flatMap(message => {
        let key;
        switch (message.source.kind) {
          case 'user':
            key = role === 'sub' ? 'subSteer' : role === 'main' ? 'userSteer' : undefined;
            break;
          case 'coordinator':
            key = role === 'sub' ? 'subSteer' : undefined;
            break;
          // Agent and team relays carry another agent's own words; the settlement
          // notice carries the runtime's account of a finished child.
          case 'agent-message':
          case 'team-message':
          case 'subagent-report':
          case 'subagent-settled':
            key = role === 'sub' ? 'subSteer' : role === 'main' ? 'agentSteer' : undefined;
            break;
          // Tool results, plugin context and extension-defined sources retain their meaning.
          default:
            return [message];
        }
        if (key === undefined) return [message];
        return [createUserMessage({
          source: {kind: sourceKind, form: 'instructions'},
          content: [{type: 'text', text: texts[key]}],
        }), message];
      }),
    };
  });
}
