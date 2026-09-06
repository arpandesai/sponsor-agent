import { scrapeUrl } from '@/lib/scrape';
import { extractOrgProfile } from '@/lib/openrouter';
import { errorMessage } from '@/lib/errors';
import { persistClubFromProfile } from '@/lib/db';

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

// Browser EventSource always issues GET — this is what the analysis screen connects to.
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(event, data)));

      if (!url) {
        send('error', { error: 'No organisation URL was provided' });
        controller.close();
        return;
      }

      try {
        const scraped = await scrapeUrl(url);
        const profile = await extractOrgProfile(scraped.text);

        for (const label of STEP_LABELS) {
          send('step', { label });
        }

        try {
          await persistClubFromProfile(profile);
        } catch {
          // persistClubFromProfile already catches its own errors — this is
          // extra insurance so a DB issue can never break the user-facing flow.
        }

        send('done', profile);
      } catch (err) {
        send('error', { error: errorMessage(err) });
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
