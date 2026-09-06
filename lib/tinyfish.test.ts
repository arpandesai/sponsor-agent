import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeUrl } from './tinyfish';

describe('scrapeUrl', () => {
  beforeEach(() => {
    process.env.TINYFISH_API_KEY = 'test-key';
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cleaned text on success', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            url: 'https://example.com',
            final_url: 'https://example.com',
            title: 'Prairie Fencing Club',
            description: '',
            language: 'en',
            format: 'markdown',
            text: '# Prairie Fencing Club\nWelcome',
          },
        ],
        errors: [],
      }),
    });

    const result = await scrapeUrl('https://example.com');
    expect(result.url).toBe('https://example.com');
    expect(result.text).toContain('Prairie Fencing Club');
  });

  it('throws a readable error when TinyFish returns an error entry with no results', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], errors: [{ url: 'https://example.com', message: 'Unreachable host' }] }),
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

  it('throws when fetch itself rejects (network/timeout)', async () => {
    (global.fetch as any).mockRejectedValue(new Error('fetch failed'));
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/fetch failed/);
  });

  it('preserves the underlying message when fetch rejects with a non-Error value', async () => {
    (global.fetch as any).mockRejectedValue('DNS lookup failed');
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/DNS lookup failed/);
  });

  it('throws a TinyFish-attributed error instead of a raw SyntaxError when the response body is not valid JSON', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    });
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/TinyFish/);
  });

  it('throws a readable error when a result exists but has no text field', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ url: 'https://example.com' }], errors: [] }),
    });
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/TinyFish/);
  });

  it('throws a readable error when the API key is missing, without calling fetch', async () => {
    delete process.env.TINYFISH_API_KEY;
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/TINYFISH_API_KEY/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
