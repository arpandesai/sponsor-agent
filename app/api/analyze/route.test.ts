import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scrape', () => ({ scrapeUrl: vi.fn() }));
vi.mock('@/lib/openrouter', () => ({ extractOrgProfile: vi.fn() }));

import { scrapeUrl } from '@/lib/scrape';
import { extractOrgProfile } from '@/lib/openrouter';
import { GET } from './route';

async function readAllEvents(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value);
  }
  return output;
}

describe('GET /api/analyze', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('streams step events then a done event with the profile', async () => {
    (scrapeUrl as any).mockResolvedValue({ url: 'https://example.com', text: 'site text' });
    (extractOrgProfile as any).mockResolvedValue({
      name: 'Prairie Fencing Club',
      location: 'Saskatoon, Saskatchewan, Canada',
      sport: 'Fencing',
      organisationType: 'Community Sports Club',
      audience: [],
      programs: [],
      fundingNeeds: [],
    });

    const request = new Request('http://localhost/api/analyze?url=https%3A%2F%2Fexample.com');
    const response = await GET(request);
    const output = await readAllEvents(response);

    expect(output).toContain('event: step');
    expect(output).toContain('Found organisation name');
    expect(output).toContain('event: done');
    expect(output).toContain('Prairie Fencing Club');
  });

  it('streams an error event when scraping fails', async () => {
    (scrapeUrl as any).mockRejectedValue(new Error('Could not reach TinyFish: timeout'));

    const request = new Request('http://localhost/api/analyze?url=https%3A%2F%2Fexample.com');
    const response = await GET(request);
    const output = await readAllEvents(response);

    expect(output).toContain('event: error');
    expect(output).toContain('timeout');
  });

  it('streams a readable error event, not a raw undefined message, when a dependency rejects with a non-Error value', async () => {
    (scrapeUrl as any).mockRejectedValue('connection reset');

    const request = new Request('http://localhost/api/analyze?url=https%3A%2F%2Fexample.com');
    const response = await GET(request);
    const output = await readAllEvents(response);

    expect(output).toContain('event: error');
    expect(output).toContain('connection reset');
    expect(output).not.toContain('undefined');
  });

  it('streams an error and never calls scrapeUrl when the url query param is missing entirely', async () => {
    const request = new Request('http://localhost/api/analyze');
    const response = await GET(request);
    const output = await readAllEvents(response);

    expect(output).toContain('event: error');
    expect(scrapeUrl).not.toHaveBeenCalled();
  });

  it('streams an error and never calls scrapeUrl for an empty url query param', async () => {
    const request = new Request('http://localhost/api/analyze?url=');
    const response = await GET(request);
    const output = await readAllEvents(response);

    expect(output).toContain('event: error');
    expect(scrapeUrl).not.toHaveBeenCalled();
  });
});
