import { parseOrgProfile, type OrgProfile } from './org-profile';
import { errorMessage } from './errors';

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
    throw new Error(`Could not reach OpenRouter: ${errorMessage(err)}`);
  }

  let json: any;
  try {
    json = await response.json();
  } catch (err) {
    throw new Error(`OpenRouter returned an unreadable response (${response.status}): ${errorMessage(err)}`);
  }

  if (!response.ok) {
    throw new Error(json.error?.message ?? `OpenRouter request failed (${response.status})`);
  }
  return json;
}

// Some models wrap JSON replies in ```json fences even when json_object mode is requested.
function stripCodeFence(content: string): string {
  const match = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : content;
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
    parsed = JSON.parse(stripCodeFence(content));
  } catch {
    parsed = {};
  }
  return parseOrgProfile(parsed);
}

const MATCHING_MODEL = 'perplexity/sonar';

export interface FundingEstimate {
  sponsorship: { count: number; minUsd: number; maxUsd: number; rationale: string };
  grants: { count: number; minUsd: number; maxUsd: number; rationale: string };
}

function zeroFundingEstimate(): FundingEstimate {
  return {
    sponsorship: { count: 0, minUsd: 0, maxUsd: 0, rationale: '' },
    grants: { count: 0, minUsd: 0, maxUsd: 0, rationale: '' },
  };
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toFundingBucket(
  raw: unknown,
  fallback: FundingEstimate['sponsorship']
): FundingEstimate['sponsorship'] {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    count: toFiniteNumber(source.count, fallback.count),
    minUsd: toFiniteNumber(source.minUsd, fallback.minUsd),
    maxUsd: toFiniteNumber(source.maxUsd, fallback.maxUsd),
    rationale: typeof source.rationale === 'string' ? source.rationale : fallback.rationale,
  };
}

// Defensively re-shapes an arbitrary value (e.g. parsed sessionStorage
// content) into a well-formed FundingEstimate instead of letting a
// corrupted/wrong-shape value crash a consumer.
export function parseFundingEstimate(input: unknown): FundingEstimate {
  const zero = zeroFundingEstimate();
  const source = (input ?? {}) as Record<string, unknown>;
  return {
    sponsorship: toFundingBucket(source.sponsorship, zero.sponsorship),
    grants: toFundingBucket(source.grants, zero.grants),
  };
}

export async function estimateFunding(profile: OrgProfile): Promise<FundingEstimate> {
  const json = await callOpenRouter({
    model: MATCHING_MODEL,
    // perplexity/sonar rejects response_format: json_object (only supports
    // json_schema or text) — rely on the prompt + stripCodeFence fallback instead.
    messages: [
      {
        role: 'system',
        content:
          'You research real sponsorship and grant funding opportunities using web search. ' +
          'Respond with ONLY a JSON object, no other text before or after it: ' +
          '{ "sponsorship": { "count": number, "minUsd": number, "maxUsd": number, "rationale": string }, ' +
          '"grants": { "count": number, "minUsd": number, "maxUsd": number, "rationale": string } }. ' +
          'count is the number of plausible real matches you found. rationale is one sentence ' +
          'explaining the estimate, citing the kind of sources used.',
      },
      { role: 'user', content: JSON.stringify(profile) },
    ],
  });

  const content = json.choices?.[0]?.message?.content ?? '';
  const zero = zeroFundingEstimate();
  try {
    const parsed = JSON.parse(stripCodeFence(content));
    return {
      sponsorship: toFundingBucket(parsed?.sponsorship, zero.sponsorship),
      grants: toFundingBucket(parsed?.grants, zero.grants),
    };
  } catch {
    return zero;
  }
}
