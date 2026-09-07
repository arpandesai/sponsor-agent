import { describe, it, expect } from 'vitest';
import { hashAdminPassword, ADMIN_COOKIE_NAME } from './adminAuth';

describe('hashAdminPassword', () => {
  it('produces a stable, deterministic hex hash for the same input', async () => {
    const a = await hashAdminPassword('correct-horse-battery-staple');
    const b = await hashAdminPassword('correct-horse-battery-staple');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different input', async () => {
    const a = await hashAdminPassword('password-one');
    const b = await hashAdminPassword('password-two');
    expect(a).not.toBe(b);
  });
});

describe('ADMIN_COOKIE_NAME', () => {
  it('is a stable constant', () => {
    expect(ADMIN_COOKIE_NAME).toBe('admin_auth');
  });
});
