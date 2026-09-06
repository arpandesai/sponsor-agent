import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import { ADMIN_COOKIE_NAME, hashAdminPassword } from '@/lib/adminAuth';

describe('POST /api/admin/login', () => {
  const originalPassword = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple';
  });
  afterEach(() => {
    if (originalPassword) process.env.ADMIN_PASSWORD = originalPassword;
    else delete process.env.ADMIN_PASSWORD;
  });

  it('sets the admin_auth cookie to the password hash on correct password', async () => {
    const request = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'correct-horse-battery-staple' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);

    const setCookie = response.headers.get('set-cookie') ?? '';
    const expectedHash = await hashAdminPassword('correct-horse-battery-staple');
    expect(setCookie).toContain(`${ADMIN_COOKIE_NAME}=${expectedHash}`);
    expect(setCookie).toContain('HttpOnly');
  });

  it('returns 401 without setting a cookie on wrong password', async () => {
    const request = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('returns 401 when ADMIN_PASSWORD is not configured, even with a matching-looking guess', async () => {
    delete process.env.ADMIN_PASSWORD;
    const request = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'anything' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 401 (not a crash) when the request body is not valid JSON', async () => {
    const request = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      body: '{not valid json',
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
