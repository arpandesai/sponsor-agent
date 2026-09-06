import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('url=https%3A%2F%2Fexample.com'),
}));

import Page from './page';

function mockEventSource(events: { type: string; data: string }[]) {
  class FakeEventSource {
    listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
    constructor(_url: string) {
      queueMicrotask(() => {
        for (const event of events) {
          this.listeners[event.type]?.forEach((cb) => cb({ data: event.data } as MessageEvent));
        }
      });
    }
    addEventListener(type: string, cb: (e: MessageEvent) => void) {
      this.listeners[type] = [...(this.listeners[type] ?? []), cb];
    }
    close() {}
  }
  // @ts-expect-error test stub
  global.EventSource = FakeEventSource;
}

describe('Analysis page', () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
  });

  it('renders step labels as they stream in, then stores profile and navigates', async () => {
    const profile = { name: 'Prairie Fencing Club', location: '', sport: '', organisationType: '', audience: [], programs: [], fundingNeeds: [] };
    mockEventSource([
      { type: 'step', data: JSON.stringify({ label: 'Found organisation name' }) },
      { type: 'done', data: JSON.stringify(profile) },
    ]);

    render(<Page />);

    await waitFor(() => expect(screen.getByText('Found organisation name')).toBeInTheDocument());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/confirm'));
    expect(JSON.parse(sessionStorage.getItem('orgProfile')!)).toEqual(profile);
  });

  it('shows an inline error with retry on an error event', async () => {
    mockEventSource([{ type: 'error', data: JSON.stringify({ error: 'Could not reach Firecrawl: timeout' }) }]);

    render(<Page />);

    await waitFor(() => expect(screen.getByText(/timeout/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
