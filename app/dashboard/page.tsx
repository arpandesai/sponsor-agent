'use client';

import { useEffect, useState } from 'react';
import type { FundingEstimate } from '@/lib/openrouter';

function formatAmount(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${Math.round(value / 1000)}K`;
}

export default function Page() {
  const [estimate, setEstimate] = useState<FundingEstimate | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('fundingEstimate');
    if (stored) setEstimate(JSON.parse(stored));
  }, []);

  if (!estimate) return null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">We found funding opportunities for you</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="fade-in-up rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6">
          <h2 className="text-sm font-medium text-[var(--color-muted)]">Sponsorship</h2>
          <p className="mt-2 text-lg font-semibold">{estimate.sponsorship.count} potential sponsors</p>
          <p className="text-2xl font-semibold">
            {formatAmount(estimate.sponsorship.minUsd)}–{formatAmount(estimate.sponsorship.maxUsd)}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{estimate.sponsorship.rationale}</p>
          <button disabled className="pressable mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-sm opacity-60">
            View Sponsors
          </button>
        </article>

        <article
          className="fade-in-up rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6"
          style={{ animationDelay: '60ms' }}
        >
          <h2 className="text-sm font-medium text-[var(--color-muted)]">Grants</h2>
          <p className="mt-2 text-lg font-semibold">{estimate.grants.count} matching grants</p>
          <p className="text-2xl font-semibold">
            {formatAmount(estimate.grants.minUsd)}–{formatAmount(estimate.grants.maxUsd)}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{estimate.grants.rationale}</p>
          <button disabled className="pressable mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-sm opacity-60">
            Find Grants
          </button>
        </article>
      </div>
    </main>
  );
}
