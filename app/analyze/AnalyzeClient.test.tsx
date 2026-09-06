import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('url=https%3A%2F%2Fexample.com'),
}));

import Page from './AnalyzeClient';

const closeSpy = vi.fn();

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
    close() {
      closeSpy();
    }
  }
  // @ts-expect-error test stub
  global.EventSource = FakeEventSource;
}

const fullProfile = {
  name: 'Prairie Fencing Club',
  location: 'Saskatoon, Saskatchewan, Canada',
  sport: 'Fencing',
  organisationType: 'Community Sports Club',
  audience: ['Youth', 'Adults'],
  programs: ['Youth Fencing'],
  fundingNeeds: ['Equipment'],
};

describe('Analysis page', () => {
  beforeEach(() => {
    push.mockClear();
    closeSpy.mockClear();
    sessionStorage.clear();
  });

  it('renders step labels as they stream in, then stores profile and navigates', async () => {
    mockEventSource([
      { type: 'step', data: JSON.stringify({ label: 'Found organisation name' }) },
      { type: 'done', data: JSON.stringify(fullProfile) },
    ]);

    render(<Page />);

    await waitFor(() => expect(screen.getByText('Found organisation name')).toBeInTheDocument());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/confirm'), { timeout: 3000 });
    expect(JSON.parse(sessionStorage.getItem('orgProfile')!)).toEqual(fullProfile);
  });

  it('shows a thinking indicator before any step has arrived', async () => {
    mockEventSource([]);
    render(<Page />);
    expect(screen.getByRole('status', { name: /thinking/i })).toBeInTheDocument();
  });

  it('reveals steps one at a time on their own pacing, not all at once (even if the server bunches them up)', async () => {
    mockEventSource([
      { type: 'step', data: JSON.stringify({ label: 'Found organisation name' }) },
      { type: 'step', data: JSON.stringify({ label: 'Identified sport' }) },
      { type: 'step', data: JSON.stringify({ label: 'Identified location' }) },
    ]);

    render(<Page />);

    // Right after the burst lands, at most one item should be visible —
    // never all three at once.
    await waitFor(() => expect(screen.getByText('Found organisation name')).toBeInTheDocument());
    expect(screen.queryByText('Identified location')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Identified location')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows a live preview panel with org details once the profile arrives', async () => {
    mockEventSource([{ type: 'done', data: JSON.stringify(fullProfile) }]);

    render(<Page />);

    await waitFor(() => expect(screen.getByText('Prairie Fencing Club')).toBeInTheDocument());
    expect(screen.getByText('Saskatoon, Saskatchewan, Canada')).toBeInTheDocument();
    expect(screen.getByText('Fencing')).toBeInTheDocument();
  });

  it('shows an inline error with retry on an error event', async () => {
    mockEventSource([{ type: 'error', data: JSON.stringify({ error: 'Could not reach TinyFish: timeout' }) }]);

    render(<Page />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/timeout/));
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('does not navigate after unmounting during the pre-navigation delay (race condition)', async () => {
    mockEventSource([{ type: 'done', data: JSON.stringify(fullProfile) }]);

    const { unmount } = render(<Page />);

    // Wait for the 'done' event to land (profile stored, navigate timer scheduled)
    // but unmount before NAVIGATE_DELAY_MS elapses.
    await waitFor(() => expect(sessionStorage.getItem('orgProfile')).not.toBeNull());
    unmount();

    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(push).not.toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });
});
