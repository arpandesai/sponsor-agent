import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/db', () => ({ getApiCallStats: vi.fn() }));

import { getApiCallStats } from '@/lib/db';
import Page from './page';

describe('Admin dashboard', () => {
  it('renders a stats row per provider', async () => {
    (getApiCallStats as any).mockResolvedValue([
      { provider: 'openrouter', totalCalls: 42, totalCost: 0.5321, avgLatencyMs: 1500, errorRate: 0.05 },
      { provider: 'monid_tinyfish', totalCalls: 100, totalCost: 0, avgLatencyMs: 2200, errorRate: 0 },
    ]);

    render(await Page());

    expect(screen.getByText('openrouter')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('monid_tinyfish')).toBeInTheDocument();
  });

  it('shows an empty state when there are no calls yet', async () => {
    (getApiCallStats as any).mockResolvedValue([]);
    render(await Page());
    expect(screen.getByText(/no api calls recorded/i)).toBeInTheDocument();
  });
});
