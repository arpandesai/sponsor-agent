import { scrapeUrl } from '@/lib/scrape';
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
  const { searchParams } = new URL(request.url);
  const bodyUrl = request.headers.get('content-length') !== '0' ? (await request.json().catch(() => ({}))).url : undefined;
  const url = bodyUrl ?? searchParams.get('url');

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
