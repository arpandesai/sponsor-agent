import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import Page from './DashboardClient';

describe('Dashboard page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(
      'fundingEstimate',
      JSON.stringify({
        sponsorship: { count: 38, minUsd: 35000, maxUsd: 65000, rationale: 'Local businesses sponsor youth fencing.' },
        grants: { count: 6, minUsd: 20000, maxUsd: 84000, rationale: 'Saskatchewan sport grants match youth programs.' },
      })
    );
  });

  it('renders sponsorship and grant summary cards with rationale', () => {
    render(<Page />);
    expect(screen.getByText('38 potential sponsors')).toBeInTheDocument();
    expect(screen.getByText(/\$35K–\$65K/)).toBeInTheDocument();
    expect(screen.getByText(/Local businesses sponsor youth fencing\./)).toBeInTheDocument();
    expect(screen.getByText(/\$20K–\$84K/)).toBeInTheDocument();
  });

  it('Find Grants CTA is present but disabled with a "coming soon" caption', () => {
    render(<Page />);
    expect(screen.getByRole('button', { name: /find grants/i })).toBeDisabled();
    expect(screen.getByText(/grant list & applications/i)).toBeInTheDocument();
  });

  it('View Sponsors is enabled and navigates to /sponsors', () => {
    push.mockClear();
    render(<Page />);
    const viewSponsors = screen.getByRole('button', { name: /view sponsors/i });
    expect(viewSponsors).not.toBeDisabled();
    fireEvent.click(viewSponsors);
    expect(push).toHaveBeenCalledWith('/sponsors');
  });

  it('formats amounts at or above $1M using an M suffix instead of a huge K value', () => {
    sessionStorage.setItem(
      'fundingEstimate',
      JSON.stringify({
        sponsorship: { count: 3, minUsd: 3000, maxUsd: 3565000, rationale: 'r' },
        grants: { count: 4, minUsd: 2000, maxUsd: 9437000, rationale: 'r' },
      })
    );
    render(<Page />);
    expect(screen.getByText(/\$3K–\$3\.6M/)).toBeInTheDocument();
    expect(screen.getByText(/\$2K–\$9\.4M/)).toBeInTheDocument();
  });

  it('shows a loading state instead of a blank page before the estimate loads', () => {
    sessionStorage.clear();
    render(<Page />);
    expect(screen.getByText(/loading your funding/i)).toBeInTheDocument();
  });

  it('does not crash when sessionStorage.fundingEstimate is corrupted JSON — stays in loading state', () => {
    sessionStorage.setItem('fundingEstimate', '{not valid json');
    expect(() => render(<Page />)).not.toThrow();
    expect(screen.getByText(/loading your funding/i)).toBeInTheDocument();
  });

  it('does not crash when sessionStorage.fundingEstimate is valid JSON but the wrong shape', () => {
    sessionStorage.setItem('fundingEstimate', JSON.stringify(['not', 'an', 'estimate']));
    expect(() => render(<Page />)).not.toThrow();
  });
});
