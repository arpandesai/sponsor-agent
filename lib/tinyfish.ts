import { errorMessage } from './errors';
import { logApiCall } from './db';

// TinyFish's own /fetch and /search are both free, but access is routed
// through Monid's marketplace proxy (https://api.monid.ai) rather than
// TinyFish's direct API — that's the account this app has credentials for.
const MONID_RUN_URL = 'https://api.monid.ai/v1/run';

function toUsd(reportedCost: { value?: number; unit?: string } | undefined): number | undefined {
  if (!reportedCost || typeof reportedCost.value !== 'number') return undefined;
  return reportedCost.unit === 'MICRO_DOLLAR' ? reportedCost.value / 1_000_000 : reportedCost.value;
}

async function callMonid(endpoint: '/fetch' | '/search', input: Record<string, unknown>): Promise<any> {
  const apiKey = process.env.MONID_API_KEY;
  if (!apiKey) throw new Error('MONID_API_KEY is not set');

  const startedAt = Date.now();

  try {
    const body = await doCallMonid(apiKey, endpoint, input);
    logApiCall({
      provider: 'monid_tinyfish',
      endpoint,
      status: 'success',
      latencyMs: Date.now() - startedAt,
      costUsd: toUsd(body.billing?.reportedCost),
      requestSummary: input,
    });
    return body.output ?? {};
  } catch (err) {
    logApiCall({
      provider: 'monid_tinyfish',
      endpoint,
      status: 'error',
      errorMessage: errorMessage(err),
      latencyMs: Date.now() - startedAt,
      requestSummary: input,
    });
    throw err;
  }
}

async function doCallMonid(apiKey: string, endpoint: '/fetch' | '/search', input: Record<string, unknown>): Promise<any> {
  let response: Response;
  try {
    response = await fetch(MONID_RUN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider: 'tinyfish', endpoint, input }),
    });
  } catch (err) {
    throw new Error(`Could not reach Monid: ${errorMessage(err)}`);
  }

  let body: any;
  try {
    body = await response.json();
  } catch (err) {
    throw new Error(`Monid returned an unreadable response (${response.status}): ${errorMessage(err)}`);
  }

  if (!response.ok) {
    throw new Error(body.message ?? `Monid request failed (${response.status})`);
  }
  if (body.status !== 'COMPLETED') {
    throw new Error(body.error?.message ?? body.message ?? `Monid run did not complete (status: ${body.status})`);
  }
  return body;
}

export interface ScrapeResult {
  url: string;
  text: string;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const output = await callMonid('/fetch', { body: { urls: [url], format: 'markdown' } });

  const result = output.results?.[0];
  if (!result || typeof result.text !== 'string') {
    const error = output.errors?.[0];
    throw new Error(error?.message ?? 'TinyFish returned no usable content for this URL');
  }

  return { url, text: result.text };
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  siteName: string;
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const output = await callMonid('/search', { queryParams: { query } });

  const results = Array.isArray(output.results) ? output.results : [];
  return results.map((r: any) => ({
    title: typeof r.title === 'string' ? r.title : '',
    snippet: typeof r.snippet === 'string' ? r.snippet : '',
    url: typeof r.url === 'string' ? r.url : '',
    siteName: typeof r.site_name === 'string' ? r.site_name : '',
  }));
}
