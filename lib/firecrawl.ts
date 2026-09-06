export interface ScrapeResult {
  url: string;
  text: string;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');

  let response: Response;
  try {
    response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, formats: ['markdown'] }),
    });
  } catch (err) {
    throw new Error(`Could not reach Firecrawl: ${(err as Error).message}`);
  }

  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(body.error ?? `Firecrawl request failed (${response.status})`);
  }

  return { url, text: body.data.markdown as string };
}
