import { scrapeUrl as scrapeWithFirecrawl } from './firecrawl';
import { scrapeUrl as scrapeWithTinyfish } from './tinyfish';
import type { ScrapeResult } from './firecrawl';
import { errorMessage } from './errors';

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  try {
    return await scrapeWithFirecrawl(url);
  } catch (firecrawlError) {
    try {
      return await scrapeWithTinyfish(url);
    } catch (tinyfishError) {
      throw new Error(
        `Both scrape providers failed. Firecrawl: ${errorMessage(firecrawlError)}. TinyFish: ${errorMessage(tinyfishError)}.`
      );
    }
  }
}
