import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./db', () => ({ logApiCall: vi.fn().mockResolvedValue(undefined) }));

import { scrapeUrl, searchWeb } from './tinyfish';
import { logApiCall } from './db';

describe('scrapeUrl', () => {
  beforeEach(() => {
    process.env.MONID_API_KEY = 'test-key';
    global.fetch = vi.fn();
    (logApiCall as any).mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cleaned text on success', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'COMPLETED',
        output: {
          results: [{ url: 'https://example.com', text: '# Prairie Fencing Club\nWelcome', format: 'markdown' }],
          errors: [],
        },
      }),
    });

    const result = await scrapeUrl('https://example.com');
    expect(result.url).toBe('https://example.com');
    expect(result.text).toContain('Prairie Fencing Club');

    const [calledUrl, calledInit] = (global.fetch as any).mock.calls[0];
    expect(calledUrl).toBe('https://api.monid.ai/v1/run');
    const body = JSON.parse(calledInit.body);
    expect(body).toEqual({ provider: 'tinyfish', endpoint: '/fetch', input: { body: { urls: ['https://example.com'], format: 'markdown' } } });
    expect(calledInit.headers.Authorization).toBe('Bearer test-key');
  });

  it('throws a readable error when Monid returns an error entry with no results', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'COMPLETED', output: { results: [], errors: [{ url: 'https://example.com', message: 'Unreachable host' }] } }),
    });

    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/Unreachable host/);
  });

  it('throws a readable error on non-ok HTTP response', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ message: 'Payment required' }),
    });

    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/Payment required/);
  });

  it('throws a readable error when the run did not complete', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'FAILED', error: { message: 'provider timeout' } }),
    });

    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/provider timeout/);
  });

  it('throws when fetch itself rejects (network/timeout)', async () => {
    (global.fetch as any).mockRejectedValue(new Error('fetch failed'));
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/fetch failed/);
  });

  it('preserves the underlying message when fetch rejects with a non-Error value', async () => {
    (global.fetch as any).mockRejectedValue('DNS lookup failed');
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/DNS lookup failed/);
  });

  it('throws a Monid-attributed error instead of a raw SyntaxError when the response body is not valid JSON', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    });
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/Monid/);
  });

  it('throws a readable error when a result exists but has no text field', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'COMPLETED', output: { results: [{ url: 'https://example.com' }], errors: [] } }),
    });
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/TinyFish/);
  });

  it('throws a readable error when the API key is missing, without calling fetch', async () => {
    delete process.env.MONID_API_KEY;
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/MONID_API_KEY/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('logs a success call with cost converted from MICRO_DOLLAR to USD', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'COMPLETED',
        output: { results: [{ url: 'https://example.com', text: 'content' }], errors: [] },
        billing: { reportedCost: { currency: 'USD', value: 1500, unit: 'MICRO_DOLLAR' } },
      }),
    });

    await scrapeUrl('https://example.com');

    expect(logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'monid_tinyfish', endpoint: '/fetch', status: 'success', costUsd: 0.0015 })
    );
  });

  it('logs a failed call with the error message', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ message: 'Payment required' }),
    });

    await expect(scrapeUrl('https://example.com')).rejects.toThrow();

    expect(logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'monid_tinyfish', endpoint: '/fetch', status: 'error', errorMessage: expect.stringContaining('Payment required') })
    );
  });
});

describe('searchWeb', () => {
  beforeEach(() => {
    process.env.MONID_API_KEY = 'test-key';
    (logApiCall as any).mockClear();
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed search results on success', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'COMPLETED',
        output: {
          query: 'Saskatoon sports sponsorship',
          results: [
            { position: 1, site_name: 'Saskatoon Soccer Centre', title: 'Sponsors', snippet: 'Our sponsors include...', url: 'https://saskatoonsoccer.com/sponsors' },
          ],
          total_results: 1,
          page: 0,
        },
      }),
    });

    const results = await searchWeb('Saskatoon sports sponsorship');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Sponsors');
    expect(results[0].url).toBe('https://saskatoonsoccer.com/sponsors');

    const [calledUrl, calledInit] = (global.fetch as any).mock.calls[0];
    expect(calledUrl).toBe('https://api.monid.ai/v1/run');
    const body = JSON.parse(calledInit.body);
    expect(body).toEqual({ provider: 'tinyfish', endpoint: '/search', input: { queryParams: { query: 'Saskatoon sports sponsorship' } } });
  });

  it('throws a readable error when fetch rejects', async () => {
    (global.fetch as any).mockRejectedValue(new Error('timeout'));
    await expect(searchWeb('query')).rejects.toThrow(/timeout/);
  });

  it('throws a readable error on non-ok HTTP response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 429, json: async () => ({ message: 'Rate limited' }) });
    await expect(searchWeb('query')).rejects.toThrow(/Rate limited/);
  });

  it('throws a readable error when the run did not complete', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'FAILED', error: { message: 'provider error' } }),
    });
    await expect(searchWeb('query')).rejects.toThrow(/provider error/);
  });

  it('throws a Monid-attributed error instead of a raw SyntaxError when the response body is not valid JSON', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    });
    await expect(searchWeb('query')).rejects.toThrow(/Monid/);
  });

  it('returns an empty array instead of throwing when results is missing', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ status: 'COMPLETED', output: { query: 'query' } }) });
    expect(await searchWeb('query')).toEqual([]);
  });

  it('throws a readable error when the API key is missing, without calling fetch', async () => {
    delete process.env.MONID_API_KEY;
    await expect(searchWeb('query')).rejects.toThrow(/MONID_API_KEY/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('logs a success call for /search with endpoint set correctly', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'COMPLETED', output: { results: [] }, billing: { reportedCost: { value: 0, unit: 'MICRO_DOLLAR' } } }),
    });

    await searchWeb('query');

    expect(logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'monid_tinyfish', endpoint: '/search', status: 'success', costUsd: 0 })
    );
  });
});
