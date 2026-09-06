import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';

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

  it('deep-dive CTAs are present but disabled', () => {
    render(<Page />);
    expect(screen.getByRole('button', { name: /view sponsors/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /find grants/i })).toBeDisabled();
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
});
