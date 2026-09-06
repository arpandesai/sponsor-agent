import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/db', () => ({ getApiCallLogs: vi.fn() }));

import { getApiCallLogs } from '@/lib/db';
import Page from './page';

describe('Admin call log', () => {
  it('renders a row per log entry and passes filters through to the query', async () => {
    (getApiCallLogs as any).mockResolvedValue([
      { id: '1', provider: 'openrouter', endpoint: null, model: 'perplexity/sonar', status: 'success', errorMessage: null, latencyMs: 1200, costUsd: 0.001, requestSummary: {}, createdAt: '2026-01-01T00:00:00Z' },
    ]);

    render(await Page({ searchParams: Promise.resolve({ provider: 'openrouter', status: 'success', page: '2' }) }));

    expect(screen.getByText('openrouter')).toBeInTheDocument();
    expect(getApiCallLogs).toHaveBeenCalledWith({ provider: 'openrouter', status: 'success', page: 2 });
  });

  it('shows an empty state when there are no matching calls', async () => {
    (getApiCallLogs as any).mockResolvedValue([]);
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/no calls found/i)).toBeInTheDocument();
  });
});
