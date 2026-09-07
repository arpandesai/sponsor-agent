import { parseOrgProfile } from '@/lib/org-profile';
import { draftPitch, type Sponsor } from '@/lib/openrouter';
import { errorMessage } from '@/lib/errors';

function parseSponsor(input: unknown): Sponsor {
  const source = (input ?? {}) as Record<string, unknown>;
  return {
    name: typeof source.name === 'string' ? source.name : '',
    matchScore: typeof source.matchScore === 'number' ? source.matchScore : 0,
    matchReason: typeof source.matchReason === 'string' ? source.matchReason : '',
    estimatedMinUsd: typeof source.estimatedMinUsd === 'number' ? source.estimatedMinUsd : 0,
    estimatedMaxUsd: typeof source.estimatedMaxUsd === 'number' ? source.estimatedMaxUsd : 0,
    category: typeof source.category === 'string' ? source.category : '',
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const { profile: rawProfile, sponsor: rawSponsor } = (body ?? {}) as Record<string, unknown>;
  const profile = parseOrgProfile(rawProfile);
  const sponsor = parseSponsor(rawSponsor);

  try {
    const draft = await draftPitch(profile, sponsor);
    return Response.json(draft);
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 502 });
  }
}
