import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ index: '0' }),
}));

import Page from './SponsorDetailClient';

const sponsors = [
  { name: 'Prairie Sports Supply', matchScore: 82, matchReason: 'Local retailer, strong fit.', estimatedMinUsd: 2000, estimatedMaxUsd: 10000, category: 'Local Business' },
];

describe('Sponsor detail page', () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
    sessionStorage.setItem('sponsorList', JSON.stringify(sponsors));
  });

  it('renders the sponsor at the given index', () => {
    render(<Page />);
    expect(screen.getByText('Prairie Sports Supply')).toBeInTheDocument();
    expect(screen.getByText('Local retailer, strong fit.')).toBeInTheDocument();
    expect(screen.getByText(/82/)).toBeInTheDocument();
  });

  it('redirects to /sponsors when sponsorList is missing', () => {
    sessionStorage.clear();
    render(<Page />);
    expect(push).toHaveBeenCalledWith('/sponsors');
  });

  it('redirects to /sponsors when the index is out of range', () => {
    sessionStorage.setItem('sponsorList', JSON.stringify([]));
    render(<Page />);
    expect(push).toHaveBeenCalledWith('/sponsors');
  });

  it('navigates to the pitch builder when Generate Pitch is clicked', () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /generate pitch/i }));
    expect(push).toHaveBeenCalledWith('/sponsors/0/pitch');
  });
});
