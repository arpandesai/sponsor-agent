import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { ADMIN_COOKIE_NAME, hashAdminPassword } from '@/lib/adminAuth';

describe('middleware', () => {
  const originalPassword = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple';
  });
  afterEach(() => {
    if (originalPassword) process.env.ADMIN_PASSWORD = originalPassword;
    else delete process.env.ADMIN_PASSWORD;
  });

  it('lets /admin/login through without a cookie', async () => {
    const request = new NextRequest('http://localhost/admin/login');
    const response = await middleware(request);
    expect(response.status).toBe(200);
  });

  it('redirects to /admin/login when the cookie is missing', async () => {
    const request = new NextRequest('http://localhost/admin');
    const response = await middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/admin/login');
  });

  it('redirects to /admin/login when the cookie value is wrong', async () => {
    const request = new NextRequest('http://localhost/admin/calls', {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=not-the-right-hash` },
    });
    const response = await middleware(request);
    expect(response.status).toBe(307);
  });

  it('passes through when the cookie matches the real password hash', async () => {
    const hash = await hashAdminPassword('correct-horse-battery-staple');
    const request = new NextRequest('http://localhost/admin/calls', {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${hash}` },
    });
    const response = await middleware(request);
    expect(response.status).toBe(200);
  });

  it('redirects (fails closed) when ADMIN_PASSWORD is not configured, even with no cookie check possible', async () => {
    delete process.env.ADMIN_PASSWORD;
    const request = new NextRequest('http://localhost/admin');
    const response = await middleware(request);
    expect(response.status).toBe(307);
  });
});
