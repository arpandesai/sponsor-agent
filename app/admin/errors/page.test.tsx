import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/db', () => ({ getApiCallErrors: vi.fn() }));

import { getApiCallErrors } from '@/lib/db';
import Page from './page';

describe('Admin error feed', () => {
  it('renders a row per error', async () => {
    (getApiCallErrors as any).mockResolvedValue([
      { id: '1', provider: 'firecrawl', endpoint: '/v1/scrape', model: null, status: 'error', errorMessage: 'timeout', latencyMs: 5000, costUsd: null, requestSummary: {}, createdAt: '2026-01-01T00:00:00Z' },
    ]);

    render(await Page());

    expect(screen.getByText('firecrawl')).toBeInTheDocument();
    expect(screen.getByText('timeout')).toBeInTheDocument();
  });

  it('shows an empty state when there are no errors', async () => {
    (getApiCallErrors as any).mockResolvedValue([]);
    render(await Page());
    expect(screen.getByText(/no errors/i)).toBeInTheDocument();
  });
});
