'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Sponsor } from '@/lib/openrouter';

function formatAmount(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value / 1000)}K`;
}

export default function SponsorDetailClient() {
  const router = useRouter();
  const params = useParams<{ index: string }>();
  const index = Number(params.index);
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('sponsorList');
    if (!stored) {
      router.push('/sponsors');
      return;
    }
    try {
      const list = JSON.parse(stored) as Sponsor[];
      const found = list[index];
      if (!found) {
        router.push('/sponsors');
        return;
      }
      setSponsor(found);
    } catch {
      router.push('/sponsors');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router.push identity is unstable under test mocks; index alone should retrigger the lookup
  }, [index]);

  if (!sponsor) return null;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-24">
      <div>
        <p className="text-sm font-medium text-[var(--color-muted)]">{sponsor.category}</p>
        <h1 className="text-2xl font-semibold">{sponsor.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{sponsor.matchScore}% match</p>
      </div>

      <p className="text-sm">{sponsor.matchReason}</p>

      <p className="text-2xl font-semibold">
        {formatAmount(sponsor.estimatedMinUsd)}–{formatAmount(sponsor.estimatedMaxUsd)}
      </p>

      <button
        type="button"
        onClick={() => router.push(`/sponsors/${index}/pitch`)}
        className="pressable self-start rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 font-medium text-[var(--color-accent-ink)]"
      >
        Generate Pitch
      </button>
    </main>
  );
}
