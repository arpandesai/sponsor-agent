import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ index: '0' }),
}));

import Page from './PitchClient';

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

describe('Pitch builder page', () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
    sessionStorage.setItem('orgProfile', JSON.stringify(profile));
    sessionStorage.setItem('sponsorList', JSON.stringify(sponsors));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ subject: 'Partnership opportunity', body: 'Hi Prairie Sports Supply team...' }),
    });
  });

  it('posts profile+sponsor to /api/pitch and renders the editable draft', async () => {
    render(<Page />);
    expect(screen.getByRole('status', { name: /thinking/i })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByDisplayValue('Partnership opportunity')).toBeInTheDocument());
    expect(screen.getByDisplayValue(/Hi Prairie Sports Supply team/)).toBeInTheDocument();

    const sentBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(sentBody.sponsor.name).toBe('Prairie Sports Supply');
    expect(sentBody.profile.name).toBe('Prairie Fencing Club');
  });

  it('lets the user edit the draft fields', async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByDisplayValue('Partnership opportunity')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Partnership opportunity'), { target: { value: 'Edited subject' } });
    expect(screen.getByDisplayValue('Edited subject')).toBeInTheDocument();
  });

  it('redirects to /sponsors when sponsorList is missing', () => {
    sessionStorage.clear();
    render(<Page />);
    expect(push).toHaveBeenCalledWith('/sponsors');
  });

  it('shows an inline error with retry when the request fails', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, json: async () => ({ error: 'Provider returned error' }) });
    render(<Page />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Provider returned error/));
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
