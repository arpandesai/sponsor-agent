import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import Page from './LoginClient';

describe('Admin login page', () => {
  beforeEach(() => {
    push.mockClear();
    global.fetch = vi.fn();
  });

  it('submits the password and redirects to /admin on success', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    render(<Page />);
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery-staple' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin'));
    const sentBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(sentBody.password).toBe('correct-horse-battery-staple');
  });

  it('shows an inline error and does not navigate on wrong password', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Invalid password' }) });

    render(<Page />);
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/invalid password/i));
    expect(push).not.toHaveBeenCalled();
  });
});
