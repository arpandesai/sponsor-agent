import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('getSql', () => {
  const originalUrl = process.env.POSTGRES_URL;

  beforeEach(() => {
    delete process.env.POSTGRES_URL;
  });

  afterEach(() => {
    if (originalUrl) process.env.POSTGRES_URL = originalUrl;
  });

  it('throws a readable error when POSTGRES_URL is not set', async () => {
    const { getSql } = await import('./db');
    expect(() => getSql()).toThrow(/POSTGRES_URL/);
  });
});
