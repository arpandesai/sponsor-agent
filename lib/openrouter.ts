import { parseOrgProfile, type OrgProfile } from './org-profile';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const EXTRACTION_MODEL = 'anthropic/claude-sonnet-4.5';

async function callOpenRouter(body: Record<string, unknown>): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Could not reach OpenRouter: ${(err as Error).message}`);
  }

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error?.message ?? `OpenRouter request failed (${response.status})`);
  }
  return json;
}

export async function extractOrgProfile(siteText: string): Promise<OrgProfile> {
  const json = await callOpenRouter({
    model: EXTRACTION_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Extract a sports organisation profile from the given website text. ' +
          'Respond with ONLY a JSON object with keys: name, location, sport, ' +
          'organisationType, audience (string array), programs (string array), ' +
          'fundingNeeds (string array of likely funding needs like Equipment, ' +
          'Athlete Travel, Youth Development, Coaching, Community Participation, Events). ' +
          'Use "" or [] for anything not found.',
      },
      { role: 'user', content: siteText.slice(0, 20000) },
    ],
  });

  const content = json.choices?.[0]?.message?.content ?? '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }
  return parseOrgProfile(parsed);
}
