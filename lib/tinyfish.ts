import { errorMessage } from './errors';

export interface ScrapeResult {
  url: string;
  text: string;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) throw new Error('TINYFISH_API_KEY is not set');

  let response: Response;
  try {
    response = await fetch('https://api.fetch.tinyfish.ai', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls: [url], format: 'markdown' }),
    });
  } catch (err) {
    throw new Error(`Could not reach TinyFish: ${errorMessage(err)}`);
  }

  let body: any;
  try {
    body = await response.json();
  } catch (err) {
    throw new Error(`TinyFish returned an unreadable response (${response.status}): ${errorMessage(err)}`);
  }

  if (!response.ok) {
    throw new Error(body.message ?? `TinyFish request failed (${response.status})`);
  }

  const result = body.results?.[0];
  if (!result || typeof result.text !== 'string') {
    const error = body.errors?.[0];
    throw new Error(error?.message ?? 'TinyFish returned no usable content for this URL');
  }

  return { url, text: result.text };
}
