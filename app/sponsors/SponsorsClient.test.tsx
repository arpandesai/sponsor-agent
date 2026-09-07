import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import Page from './SponsorsClient';

const profile = {
  name: 'Prairie Fencing Club',
  location: 'Saskatoon, Saskatchewan, Canada',
  sport: 'Fencing',
  organisationType: 'Community Sports Club',
  audience: ['Youth'],
  programs: ['Youth Fencing'],
  fundingNeeds: ['Equipment'],
};

const sponsors = [
  { name: 'Prairie Sports Supply', matchScore: 82, matchReason: 'Local retailer, strong fit.', estimatedMinUsd: 2000, estimatedMaxUsd: 10000, category: 'Local Business' },
];

describe('Sponsors list page', () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
    sessionStorage.setItem('orgProfile', JSON.stringify(profile));
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => sponsors });
  });

  it('explains why the search may take a while, and links back to the dashboard', async () => {
    render(<Page />);
    expect(screen.getByText(/can take up to a minute/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/dashboard');
  });

  it('redirects to / when there is no orgProfile in sessionStorage', () => {
    sessionStorage.clear();
    render(<Page />);
    expect(push).toHaveBeenCalledWith('/');
  });

  it('shows a thinking indicator, then renders sponsor cards and stores the list', async () => {
    render(<Page />);
    expect(screen.getByRole('status', { name: /thinking/i })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Prairie Sports Supply')).toBeInTheDocument());
    expect(screen.getByText(/82/)).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('sponsorList')!)).toEqual(sponsors);
  });

  it('navigates to the detail screen by index when a card is clicked', async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText('Prairie Sports Supply')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Prairie Sports Supply'));
    expect(push).toHaveBeenCalledWith('/sponsors/0');
  });

  it('shows an empty state when no sponsors are found', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => [] });
    render(<Page />);
    await waitFor(() => expect(screen.getByText(/no sponsor matches/i)).toBeInTheDocument());
  });

  it('shows an inline error with retry when the request fails', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, json: async () => ({ error: 'Provider returned error' }) });
    render(<Page />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Provider returned error/));
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('filters out confirmed_existing sponsors — only prospects are shown, clickable, and stored', async () => {
    const mixed = [
      { name: 'Already Sponsors Us', relationship: 'confirmed_existing', matchScore: 95, matchReason: 'r', estimatedMinUsd: 0, estimatedMaxUsd: 0, category: 'Local Business' },
      { name: 'New Prospect', relationship: 'prospect', matchScore: 80, matchReason: 'r', estimatedMinUsd: 1000, estimatedMaxUsd: 5000, category: 'Local Business' },
    ];
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => mixed });

    render(<Page />);
    await waitFor(() => expect(screen.getByText('New Prospect')).toBeInTheDocument());

    expect(screen.queryByText('Already Sponsors Us')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('New Prospect'));
    expect(push).toHaveBeenCalledWith('/sponsors/0');
    expect(JSON.parse(sessionStorage.getItem('sponsorList')!)).toEqual([mixed[1]]);
  });
});
