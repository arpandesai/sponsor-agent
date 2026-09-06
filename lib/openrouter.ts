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

export interface Sponsor {
  name: string;
  matchScore: number;
  matchReason: string;
  estimatedMinUsd: number;
  estimatedMaxUsd: number;
  category: string;
}

function toSponsor(raw: unknown): Sponsor | null {
  const source = (raw ?? {}) as Record<string, unknown>;
  if (typeof source.name !== 'string' || typeof source.matchReason !== 'string') return null;
  return {
    name: source.name,
    matchScore: toFiniteNumber(source.matchScore, 0),
    matchReason: source.matchReason,
    estimatedMinUsd: toFiniteNumber(source.estimatedMinUsd, 0),
    estimatedMaxUsd: toFiniteNumber(source.estimatedMaxUsd, 0),
    category: typeof source.category === 'string' ? source.category : '',
  };
}

export async function findSponsors(profile: OrgProfile): Promise<Sponsor[]> {
  const json = await callOpenRouter({
    model: MATCHING_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You research real companies likely to sponsor a sports organisation, using web search. ' +
          'Respond with ONLY a JSON object, no other text before or after it: ' +
          '{ "sponsors": [ { "name": string, "matchScore": number (0-100), "matchReason": string ' +
          '(one sentence explaining the match), "estimatedMinUsd": number, "estimatedMaxUsd": number, ' +
          '"category": string (e.g. "Local Business", "National Brand") } ] }. ' +
          'Return 8-12 real, plausible companies. Every entry must have all fields.',
      },
      { role: 'user', content: JSON.stringify(profile) },
    ],
  });

  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(stripCodeFence(content));
    const list = Array.isArray(parsed?.sponsors) ? parsed.sponsors : [];
    return list.map(toSponsor).filter((s: Sponsor | null): s is Sponsor => s !== null);
  } catch {
    return [];
  }
}

export interface PitchDraft {
  subject: string;
  body: string;
}

function fallbackPitchDraft(profile: OrgProfile, sponsor: Sponsor): PitchDraft {
  return {
    subject: `Partnership opportunity: ${profile.name || 'our organisation'} x ${sponsor.name}`,
    body:
      `Hi ${sponsor.name} team,\n\n` +
      `We're ${profile.name || 'a sports organisation'} and think there's a strong fit for a sponsorship ` +
      `partnership. ${sponsor.matchReason}\n\nWould you be open to a short call to discuss?\n\nThanks,\n${profile.name || 'Our team'}`,
  };
}

export async function draftPitch(profile: OrgProfile, sponsor: Sponsor): Promise<PitchDraft> {
  const json = await callOpenRouter({
    model: MATCHING_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You write a short, warm sponsorship outreach email from a sports organisation to a potential ' +
          'sponsor. Respond with ONLY a JSON object, no other text before or after it: ' +
          '{ "subject": string, "body": string }. Reference the specific match reason given. Keep the body ' +
          'under 150 words.',
      },
      { role: 'user', content: JSON.stringify({ profile, sponsor }) },
    ],
  });

  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(stripCodeFence(content));
    if (typeof parsed?.subject === 'string' && typeof parsed?.body === 'string') {
      return { subject: parsed.subject, body: parsed.body };
    }
    return fallbackPitchDraft(profile, sponsor);
  } catch {
    return fallbackPitchDraft(profile, sponsor);
  }
}
