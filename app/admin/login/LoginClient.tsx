'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function LoginClient() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? 'Invalid password');
      setSubmitting(false);
      return;
    }
    router.push('/admin');
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">Admin Login</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="admin-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-base"
        />
        <button
          type="submit"
          disabled={submitting}
          className="pressable rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 font-medium text-[var(--color-accent-ink)] disabled:opacity-60"
        >
          {submitting ? 'Logging in…' : 'Log In'}
        </button>
      </form>

      {error ? <ErrorBanner message={error} onRetry={() => setError(null)} /> : null}
    </main>
  );
}
