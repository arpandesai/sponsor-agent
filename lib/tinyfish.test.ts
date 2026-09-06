import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeUrl, searchWeb } from './tinyfish';

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

describe('searchWeb', () => {
  beforeEach(() => {
    process.env.TINYFISH_API_KEY = 'test-key';
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed search results on success', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'Saskatoon sports sponsorship',
        results: [
          { position: 1, site_name: 'Saskatoon Soccer Centre', title: 'Sponsors', snippet: 'Our sponsors include...', url: 'https://saskatoonsoccer.com/sponsors' },
        ],
        total_results: 1,
        page: 1,
      }),
    });

    const results = await searchWeb('Saskatoon sports sponsorship');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Sponsors');
    expect(results[0].url).toBe('https://saskatoonsoccer.com/sponsors');

    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain('api.search.tinyfish.ai');
    expect(calledUrl).toContain(encodeURIComponent('Saskatoon sports sponsorship'));
  });

  it('throws a readable error when fetch rejects', async () => {
    (global.fetch as any).mockRejectedValue(new Error('timeout'));
    await expect(searchWeb('query')).rejects.toThrow(/timeout/);
  });

  it('throws a readable error on non-ok HTTP response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 429, json: async () => ({ message: 'Rate limited' }) });
    await expect(searchWeb('query')).rejects.toThrow(/Rate limited/);
  });

  it('throws a TinyFish-attributed error instead of a raw SyntaxError when the response body is not valid JSON', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    });
    await expect(searchWeb('query')).rejects.toThrow(/TinyFish/);
  });

  it('returns an empty array instead of throwing when results is missing', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ query: 'query' }) });
    expect(await searchWeb('query')).toEqual([]);
  });

  it('throws a readable error when the API key is missing, without calling fetch', async () => {
    delete process.env.TINYFISH_API_KEY;
    await expect(searchWeb('query')).rejects.toThrow(/TINYFISH_API_KEY/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
