import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockPathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => mockPathname }));

import { Header } from './Header';

describe('Header', () => {
  it('shows the SportsFirst wordmark and no step indicator on the landing page', () => {
    mockPathname = '/';
    render(<Header />);
    expect(screen.getByText('SportsFirst')).toBeInTheDocument();
    expect(screen.queryByText(/step \d of 3/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /start over/i })).not.toBeInTheDocument();
  });

  it('shows "Step 1 of 3" and a Start Over link on /analyze', () => {
    mockPathname = '/analyze';
    render(<Header />);
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start over/i })).toHaveAttribute('href', '/');
  });

  it('shows "Step 2 of 3" on /confirm', () => {
    mockPathname = '/confirm';
    render(<Header />);
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
  });

  it('shows "Step 3 of 3" on /dashboard', () => {
    mockPathname = '/dashboard';
    render(<Header />);
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
  });
});
