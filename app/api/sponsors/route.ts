import { parseOrgProfile } from '@/lib/org-profile';
import { findSponsors } from '@/lib/openrouter';
import { errorMessage } from '@/lib/errors';
import { persistSponsorDiscovery } from '@/lib/db';

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

    try {
      await persistSponsorDiscovery(profile, sponsors);
    } catch {
      // persistSponsorDiscovery already catches its own errors — this is
      // extra insurance so a DB issue can never break the user-facing flow.
    }

    return Response.json(sponsors);
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 502 });
  }
}
