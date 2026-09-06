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
    throw new Error(`Could not reach TinyFish: ${(err as Error).message}`);
  }

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message ?? `TinyFish request failed (${response.status})`);
  }

  const result = body.results?.[0];
  if (!result) {
    const error = body.errors?.[0];
    throw new Error(error?.message ?? 'TinyFish returned no result for this URL');
  }

  return { url, text: result.text as string };
}
