import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import Page from './ConfirmClient';

const profile = {
  name: 'Prairie Fencing Club',
  location: 'Saskatoon, Saskatchewan, Canada',
  sport: 'Fencing',
  organisationType: 'Community Sports Club',
  audience: ['Youth', 'Adults'],
  programs: ['Youth Fencing'],
  fundingNeeds: ['Equipment'],
};

describe('Confirm page', () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
    sessionStorage.setItem('orgProfile', JSON.stringify(profile));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sponsorship: { count: 38, minUsd: 35000, maxUsd: 65000, rationale: 'r' },
        grants: { count: 6, minUsd: 20000, maxUsd: 84000, rationale: 'r' },
      }),
    });
  });

  it('pre-fills the form from sessionStorage', () => {
    render(<Page />);
    expect(screen.getByDisplayValue('Prairie Fencing Club')).toBeInTheDocument();
    expect(screen.getByText('Youth Fencing')).toBeInTheDocument();
  });

  it('removing a funding-need chip excludes it from the submitted profile', async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /remove equipment/i }));
    fireEvent.click(screen.getByRole('button', { name: /looks good/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const sentBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(sentBody.fundingNeeds).not.toContain('Equipment');
  });

  it('navigates to dashboard with the funding estimate stored', async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /looks good/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(JSON.parse(sessionStorage.getItem('fundingEstimate')!).sponsorship.count).toBe(38);
  });

  it('shows an inline error with retry when /api/funding fails, without navigating', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'Provider returned error' }),
    });

    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /looks good/i }));

    await waitFor(() => expect(screen.getByText(/Provider returned error/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('fundingEstimate')).toBeNull();
  });
});
