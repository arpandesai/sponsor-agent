import { parseOrgProfile } from '@/lib/org-profile';
import { estimateFunding } from '@/lib/openrouter';
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
    const estimate = await estimateFunding(profile);
    return Response.json(estimate);
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 502 });
  }
}
