import { ADMIN_COOKIE_NAME, hashAdminPassword } from '@/lib/adminAuth';

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.ADMIN_PASSWORD;
  const { password } = await request.json().catch(() => ({ password: undefined }));

  if (!expected || password !== expected) {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }

  const hash = await hashAdminPassword(expected);
  const response = Response.json({ ok: true });
  response.headers.set(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=${hash}; Path=/; HttpOnly; SameSite=Lax`
  );
  return response;
}
