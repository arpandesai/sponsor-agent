import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/db', () => ({ getClubsOverview: vi.fn(), getDiscoveryRunsForClub: vi.fn() }));

import { getClubsOverview, getDiscoveryRunsForClub } from '@/lib/db';
import Page from './page';

describe('Admin clubs overview', () => {
  it('renders a row per club with sponsor counts and its discovery run history', async () => {
    (getClubsOverview as any).mockResolvedValue([
      { id: 'club-1', name: 'Prairie Fencing Club', sport: 'Fencing', city: 'Saskatoon', region: 'Saskatchewan', country: 'Canada', matchCount: 8, relationshipCount: 2 },
    ]);
    (getDiscoveryRunsForClub as any).mockResolvedValue([
      { runType: 'sponsor_discovery', status: 'completed', candidatesFound: 12, candidatesQualified: 8, startedAt: '2026-01-01T00:00:00Z' },
    ]);

    render(await Page());

    expect(screen.getByText('Prairie Fencing Club')).toBeInTheDocument();
    expect(screen.getByText(/8 sponsor matches/)).toBeInTheDocument();
    expect(getDiscoveryRunsForClub).toHaveBeenCalledWith('club-1');
  });

  it('shows an empty state when there are no clubs yet', async () => {
    (getClubsOverview as any).mockResolvedValue([]);
    render(await Page());
    expect(screen.getByText(/no clubs analyzed/i)).toBeInTheDocument();
  });
});
