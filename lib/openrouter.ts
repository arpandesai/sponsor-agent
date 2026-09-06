import { parseOrgProfile, type OrgProfile } from './org-profile';
import { errorMessage } from './errors';
import { searchWeb } from './tinyfish';

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

export interface EvidenceItem {
  claim: string;
  sourceUrl: string;
  sourceTitle?: string;
  sourceType?: string;
  evidenceType?: string;
}

export interface Sponsor {
  name: string;
  matchScore: number;
  matchReason: string;
  estimatedMinUsd: number;
  estimatedMaxUsd: number;
  category: string;
  relationship?: 'confirmed_existing' | 'prospect';
  city?: string;
  region?: string;
  country?: string;
  evidenceScore?: number;
  geographyScore?: number;
  sportScore?: number;
  audienceScore?: number;
  causeScore?: number;
  scaleScore?: number;
  recencyScore?: number;
  evidenceConfidence?: 'high' | 'medium' | 'low';
  classification?: 'exceptional' | 'strong' | 'good' | 'explore';
  recommendedAngle?: string;
  currency?: string;
  estimateConfidence?: 'high' | 'medium' | 'low';
  evidence?: EvidenceItem[];
}

function toEvidenceItem(raw: unknown): EvidenceItem | null {
  const source = (raw ?? {}) as Record<string, unknown>;
  if (typeof source.claim !== 'string' || typeof source.sourceUrl !== 'string') return null;
  return {
    claim: source.claim,
    sourceUrl: source.sourceUrl,
    sourceTitle: typeof source.sourceTitle === 'string' ? source.sourceTitle : undefined,
    sourceType: typeof source.sourceType === 'string' ? source.sourceType : undefined,
    evidenceType: typeof source.evidenceType === 'string' ? source.evidenceType : undefined,
  };
}

function toOptionalScore(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function toSponsor(raw: unknown): Sponsor | null {
  const source = (raw ?? {}) as Record<string, unknown>;
  if (typeof source.name !== 'string' || typeof source.matchReason !== 'string') return null;
  const evidence = Array.isArray(source.evidence)
    ? source.evidence.map(toEvidenceItem).filter((e): e is EvidenceItem => e !== null)
    : undefined;
  return {
    name: source.name,
    matchScore: toFiniteNumber(source.matchScore, 0),
    matchReason: source.matchReason,
    estimatedMinUsd: toFiniteNumber(source.estimatedMinUsd, 0),
    estimatedMaxUsd: toFiniteNumber(source.estimatedMaxUsd, 0),
    category: typeof source.category === 'string' ? source.category : '',
    relationship: source.relationship === 'confirmed_existing' ? 'confirmed_existing' : 'prospect',
    city: typeof source.city === 'string' ? source.city : undefined,
    region: typeof source.region === 'string' ? source.region : undefined,
    country: typeof source.country === 'string' ? source.country : undefined,
    evidenceScore: toOptionalScore(source.evidenceScore),
    geographyScore: toOptionalScore(source.geographyScore),
    sportScore: toOptionalScore(source.sportScore),
    audienceScore: toOptionalScore(source.audienceScore),
    causeScore: toOptionalScore(source.causeScore),
    scaleScore: toOptionalScore(source.scaleScore),
    recencyScore: toOptionalScore(source.recencyScore),
    evidenceConfidence:
      source.evidenceConfidence === 'high' || source.evidenceConfidence === 'medium' || source.evidenceConfidence === 'low'
        ? source.evidenceConfidence
        : undefined,
    classification:
      source.classification === 'exceptional' ||
      source.classification === 'strong' ||
      source.classification === 'good' ||
      source.classification === 'explore'
        ? source.classification
        : undefined,
    recommendedAngle: typeof source.recommendedAngle === 'string' ? source.recommendedAngle : undefined,
    currency: typeof source.currency === 'string' ? source.currency : undefined,
    estimateConfidence:
      source.estimateConfidence === 'high' || source.estimateConfidence === 'medium' || source.estimateConfidence === 'low'
        ? source.estimateConfidence
        : undefined,
    evidence,
  };
}

const OTHER_SPORTS = ['soccer', 'hockey', 'basketball', 'swimming', 'gymnastics', 'athletics'];

// Pure and deterministic — no API call. Encodes the query-expansion
// methodology (location+sport, location+community, competitor-sport mining,
// industry-specific) that used to live only inside the LLM prompt.
export function buildSponsorSearchQueries(profile: OrgProfile): string[] {
  const city = profile.city || profile.location.split(',')[0]?.trim() || '';
  if (!city) return [];
  const region = profile.region || profile.location.split(',')[1]?.trim() || '';
  const competitorSports = OTHER_SPORTS.filter((s) => s.toLowerCase() !== profile.sport.toLowerCase());

  return [
    `${city} sports sponsorship`,
    `${city} youth sport sponsor`,
    ...(region ? [`${region} sports sponsorship`] : []),
    `${city} community sponsorship`,
    `${city} community investment`,
    `${city} sponsor youth`,
    ...competitorSports.map((sport) => `${city} ${sport} club sponsors`),
    `${city} credit union sponsorship`,
    `${city} dealership sports sponsor`,
    `${city} law firm sports sponsorship`,
    `${city} insurance community sponsorship`,
    `${city} dental youth sports sponsor`,
  ];
}

const SPONSOR_SYSTEM_PROMPT =
  'You are a sponsorship prospecting research assistant. You are given the organisation\'s profile and real ' +
  'web search results (title/url/snippet) gathered for it — use ONLY this provided context as your evidence, ' +
  'do not invent facts beyond it.\n\n' +
  'First, identify from the search results any companies that ALREADY sponsor or partner with this ' +
  'organisation today — mark these with relationship: "confirmed_existing".\n\n' +
  'Then identify 8-12 NEW prospective sponsor companies (relationship: "prospect") that are NOT already ' +
  'sponsors — prefer real local/regional businesses over generic national brand guesses. Prioritize any ' +
  'candidate the search results show sponsoring 2+ OTHER local sports organisations — that is the strongest ' +
  'signal (a demonstrated, repeated willingness to fund local sport).\n\n' +
  'For every entry (existing or prospect), evidence must be an array of { claim, sourceUrl } pulled from the ' +
  'provided search results — never a generic reason with no evidence behind it.\n\n' +
  'Respond with ONLY a JSON object, no other text before or after it: ' +
  '{ "sponsors": [ { "name": string, "category": string, "relationship": "confirmed_existing" | "prospect", ' +
  '"matchScore": number (0-100), "matchReason": string, "estimatedMinUsd": number, "estimatedMaxUsd": number, ' +
  '"evidence": [ { "claim": string, "sourceUrl": string } ] } ] }.';

async function synthesizeSponsors(profile: OrgProfile, searchContext: string): Promise<Sponsor[]> {
  const json = await callOpenRouter({
    model: EXTRACTION_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SPONSOR_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ profile, searchResults: searchContext }) },
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

// Free-search path: generate queries, fan them out to TinyFish's free Search
// API, synthesize the results. Returns null (not []) when every query failed
// so the caller can fall back to the paid direct-search model, rather than
// confusing "TinyFish is down" with "genuinely no sponsors found".
async function findSponsorsViaSearch(profile: OrgProfile): Promise<Sponsor[] | null> {
  const queries = buildSponsorSearchQueries(profile);
  if (queries.length === 0) return null;

  const settled = await Promise.allSettled(queries.map((q) => searchWeb(q)));
  const allResults = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (allResults.length === 0) return null;

  const context = allResults
    .slice(0, 150)
    .map((r) => `- ${r.title} (${r.url}): ${r.snippet}`)
    .join('\n');
  return synthesizeSponsors(profile, context);
}

// Fallback: the original single-call, paid web-search-grounded approach.
async function findSponsorsViaDirectSearch(profile: OrgProfile): Promise<Sponsor[]> {
  const json = await callOpenRouter({
    model: MATCHING_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a sponsorship prospecting research assistant using web search. Follow this exact ' +
          'methodology — the first two steps are internal research, do not output them.\n\n' +
          'STEP 1 (internal): search for and build a mental exclude-list of companies that ALREADY sponsor ' +
          'or partner with this organisation today — check their website, annual reports, press releases, ' +
          'and "thank you to our sponsors" pages.\n\n' +
          'STEP 2 (internal) — Local Sponsor Graph: search for OTHER sports organisations in the same city/' +
          'region as this one, in DIFFERENT sports (e.g. if this is a fencing club in Saskatoon, search for ' +
          'Saskatoon soccer clubs, hockey clubs, swimming clubs, gymnastics clubs, athletics clubs). For each ' +
          'one you find, search for its sponsors/partners. A company that already sponsors multiple local ' +
          'sports organisations has demonstrated, repeated willingness to fund local sport — that is a far ' +
          'stronger signal than merely being "a company in the right industry with no track record."\n\n' +
          'Use these search angles across steps 1-2:\n' +
          '- Location + sport: "<city>" sports sponsorship, "<city>" youth sport sponsor, "<region>" sports sponsorship\n' +
          '- Location + community: "<city>" community sponsorship, "<city>" community investment, "<city>" sponsor youth\n' +
          '- Competitor-sport mining: "<city> <other sport> club sponsors" for several other sports in the same city\n' +
          '- Industry-specific: "<city>" credit union sponsorship, "<city>" dealership sports sponsor, ' +
          '"<city>" law firm sports sponsorship, "<city>" insurance community sponsorship, "<city>" dental youth sports sponsor\n\n' +
          'STEP 3 (your actual output): suggest 8-12 NEW prospective sponsor companies — prefer real local/' +
          'regional businesses actually operating in this organisation\'s city over generic national brand ' +
          'guesses, unless a national brand has documented local/community sponsorship activity in this ' +
          'specific region. None may already sponsor this organisation (your step-1 exclude-list).\n\n' +
          'Prioritize and clearly flag any candidate you found sponsoring 2+ other local sports organisations ' +
          'in step 2 — that is your strongest signal. For every entry, matchReason must cite the specific ' +
          'evidence: which other local sports organisation(s) they sponsor (for graph-matched candidates), or ' +
          'their documented CSR/community-sponsorship program (for others). Never a generic reason with no ' +
          'evidence behind it.\n\n' +
          'Respond with ONLY a JSON object, no other text before or after it: ' +
          '{ "sponsors": [ { "name": string, "matchScore": number (0-100), "matchReason": string, ' +
          '"estimatedMinUsd": number, "estimatedMaxUsd": number, ' +
          '"category": string (e.g. "Local Business", "National Brand") } ] }. ' +
          'Every entry must have all fields.',
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

export async function findSponsors(profile: OrgProfile): Promise<Sponsor[]> {
  const viaSearch = await findSponsorsViaSearch(profile);
  if (viaSearch !== null) return viaSearch;
  return findSponsorsViaDirectSearch(profile);
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
