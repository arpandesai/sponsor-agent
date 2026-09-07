'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

  if (!sponsor) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-24">
        <p className="text-sm text-[var(--color-muted)]">Loading sponsor…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-24">
      <Link href="/sponsors" className="text-sm text-[var(--color-muted)] underline">
        ← Back to Sponsors
      </Link>

      <div>
        <p className="text-sm font-medium text-[var(--color-muted)]">{sponsor.category}</p>
        <h1 className="text-2xl font-semibold">{sponsor.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{sponsor.matchScore}% match</p>
      </div>

      <p className="text-sm">{sponsor.matchReason}</p>

      <p className="text-2xl font-semibold">
        {formatAmount(sponsor.estimatedMinUsd)}–{formatAmount(sponsor.estimatedMaxUsd)}
      </p>

      {sponsor.evidence && sponsor.evidence.length > 0 ? (
        <div>
          <h2 className="mb-2 text-sm font-medium">Sources</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {sponsor.evidence.map((item, i) => (
              <li key={i} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                <p>{item.claim}</p>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] underline"
                >
                  {item.sourceTitle || item.sourceUrl}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
