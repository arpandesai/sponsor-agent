import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBanner } from './ErrorBanner';

describe('ErrorBanner', () => {
  it('shows an alert role, the message, and calls onRetry when clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Could not reach TinyFish: timeout" onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach TinyFish: timeout');
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
