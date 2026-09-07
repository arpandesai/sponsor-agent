import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./firecrawl', () => ({ scrapeUrl: vi.fn() }));
vi.mock('./tinyfish', () => ({ scrapeUrl: vi.fn() }));

import { scrapeUrl as firecrawlScrape } from './firecrawl';
import { scrapeUrl as tinyfishScrape } from './tinyfish';
import { scrapeUrl } from './scrape';

describe('scrapeUrl (Firecrawl-first with TinyFish fallback)', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('returns the Firecrawl result when Firecrawl succeeds, without calling TinyFish', async () => {
    (firecrawlScrape as any).mockResolvedValue({ url: 'https://example.com', text: 'from firecrawl' });

    const result = await scrapeUrl('https://example.com');

    expect(result.text).toBe('from firecrawl');
    expect(tinyfishScrape).not.toHaveBeenCalled();
  });

  it('falls back to TinyFish when Firecrawl throws', async () => {
    (firecrawlScrape as any).mockRejectedValue(new Error('FIRECRAWL_API_KEY is not set'));
    (tinyfishScrape as any).mockResolvedValue({ url: 'https://example.com', text: 'from tinyfish' });

    const result = await scrapeUrl('https://example.com');

    expect(result.text).toBe('from tinyfish');
  });

  it('throws a combined error when both providers fail', async () => {
    (firecrawlScrape as any).mockRejectedValue(new Error('Firecrawl down'));
    (tinyfishScrape as any).mockRejectedValue(new Error('TinyFish down'));

    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/Firecrawl down.*TinyFish down/s);
  });

  it('produces a readable combined message even when a provider rejects with a non-Error value', async () => {
    (firecrawlScrape as any).mockRejectedValue('a plain string rejection');
    (tinyfishScrape as any).mockRejectedValue(undefined);

    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/Both scrape providers failed/);
  });

  it('produces a readable combined message when both providers reject with undefined', async () => {
    (firecrawlScrape as any).mockRejectedValue(undefined);
    (tinyfishScrape as any).mockRejectedValue(undefined);

    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/Both scrape providers failed/);
  });
});
