import { parseOrgProfile } from '@/lib/org-profile';
import { findSponsors } from '@/lib/openrouter';
import { errorMessage } from '@/lib/errors';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const profile = parseOrgProfile(body);

  try {
    const sponsors = await findSponsors(profile);
    return Response.json(sponsors);
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 502 });
  }
}
