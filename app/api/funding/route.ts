import { parseOrgProfile } from '@/lib/org-profile';
import { estimateFunding } from '@/lib/openrouter';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const profile = parseOrgProfile(body);

  try {
    const estimate = await estimateFunding(profile);
    return Response.json(estimate);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
