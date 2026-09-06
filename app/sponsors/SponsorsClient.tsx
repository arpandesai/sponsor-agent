'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Sponsor } from '@/lib/openrouter';
import { ErrorBanner } from '@/components/ErrorBanner';

function formatAmount(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value / 1000)}K`;
}

export default function SponsorsClient() {
  const router = useRouter();
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem('orgProfile');
    if (!stored) {
      router.push('/');
      return;
    }

    setSponsors(null);
    setError(null);

    (async () => {
      const response = await fetch('/api/sponsors', { method: 'POST', body: stored });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? 'Something went wrong finding sponsors.');
        return;
      }
      setSponsors(body);
      sessionStorage.setItem('sponsorList', JSON.stringify(body));
    })();
  }, [router, attempt]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">Sponsors likely to fund you</h1>

      {error ? (
        <ErrorBanner message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : sponsors === null ? (
        <div role="status" aria-label="Thinking" className="flex items-center gap-1.5 py-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:300ms]" />
        </div>
      ) : sponsors.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No sponsor matches found yet — try again shortly.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sponsors.map((sponsor, index) => (
            <button
              key={sponsor.name}
              type="button"
              onClick={() => router.push(`/sponsors/${index}`)}
              className="pressable fade-in-up rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 text-left"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <p className="text-sm font-medium text-[var(--color-muted)]">{sponsor.category}</p>
              <p className="mt-1 text-lg font-semibold">{sponsor.name}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{sponsor.matchScore}% match</p>
              <p className="mt-2 text-sm">{sponsor.matchReason}</p>
              <p className="mt-2 text-sm font-medium">
                {formatAmount(sponsor.estimatedMinUsd)}–{formatAmount(sponsor.estimatedMaxUsd)}
              </p>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
