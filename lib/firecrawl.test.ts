import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./db', () => ({ logApiCall: vi.fn().mockResolvedValue(undefined) }));

import { scrapeUrl } from './firecrawl';
import { logApiCall } from './db';

describe('scrapeUrl', () => {
  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = 'test-key';
    global.fetch = vi.fn();
    (logApiCall as any).mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cleaned text on success', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { markdown: '# Prairie Fencing Club\nWelcome' } }),
    });

    const result = await scrapeUrl('https://example.com');
    expect(result.url).toBe('https://example.com');
    expect(result.text).toContain('Prairie Fencing Club');
  });

  it('throws a readable error when Firecrawl returns failure', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ success: false, error: 'Payment required' }),
    });

    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/Payment required/);
  });

  it('throws when fetch itself rejects (network/timeout)', async () => {
    (global.fetch as any).mockRejectedValue(new Error('fetch failed'));
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/fetch failed/);
  });

  it('throws a readable error when fetch rejects with a non-Error value', async () => {
    (global.fetch as any).mockRejectedValue('DNS lookup failed');
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/DNS lookup failed/);
  });

  it('throws a Firecrawl-attributed error instead of a raw SyntaxError when the response body is not valid JSON', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    });
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/Firecrawl/);
  });

  it('throws a Firecrawl-attributed error instead of a raw TypeError when success is true but data is missing', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/Firecrawl/);
  });

  it('throws a readable error when the API key is missing, without calling fetch', async () => {
    delete process.env.FIRECRAWL_API_KEY;
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/FIRECRAWL_API_KEY/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('logs a success call with cost null (Firecrawl exposes no per-call cost)', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { markdown: 'content' } }),
    });

    await scrapeUrl('https://example.com');

    expect(logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'firecrawl', status: 'success' })
    );
    expect((logApiCall as any).mock.calls[0][0].costUsd).toBeUndefined();
    expect((logApiCall as any).mock.calls[0][0].latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('logs a failed call with the error message', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ success: false, error: 'Payment required' }),
    });

    await expect(scrapeUrl('https://example.com')).rejects.toThrow();

    expect(logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'firecrawl', status: 'error', errorMessage: expect.stringContaining('Payment required') })
    );
  });
});
