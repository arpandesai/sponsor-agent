import { scrapeUrl } from '@/lib/firecrawl';
import { extractOrgProfile } from '@/lib/openrouter';

const STEP_LABELS = [
  'Found organisation name',
  'Identified sport',
  'Identified location',
  'Found programs',
  'Identified possible funding needs',
];

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request): Promise<Response> {
  const { url } = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(event, data)));

      try {
        const scraped = await scrapeUrl(url);
        const profile = await extractOrgProfile(scraped.text);

        for (const label of STEP_LABELS) {
          send('step', { label });
        }
        send('done', profile);
      } catch (err) {
        send('error', { error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
