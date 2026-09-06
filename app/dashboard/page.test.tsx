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
});
