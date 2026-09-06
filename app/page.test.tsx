import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import Page from './page';

describe('Landing page', () => {
  it('navigates to /analyze with the encoded url on submit', () => {
    render(<Page />);
    const input = screen.getByLabelText(/organisation website/i);
    fireEvent.change(input, { target: { value: 'https://prairiefencing.ca' } });
    fireEvent.click(screen.getByRole('button', { name: /find funding opportunities/i }));
    expect(push).toHaveBeenCalledWith('/analyze?url=https%3A%2F%2Fprairiefencing.ca');
  });

  it('shows both outcome cards', () => {
    render(<Page />);
    expect(screen.getByText('Sponsor Agent')).toBeInTheDocument();
    expect(screen.getByText('Grant Agent')).toBeInTheDocument();
  });
});
