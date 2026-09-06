'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { emptyOrgProfile, type OrgProfile } from '@/lib/org-profile';

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="pressable flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-sm">
      {label}
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="pressable">
        ×
      </button>
    </span>
  );
}

export default function Page() {
  const router = useRouter();
  const [profile, setProfile] = useState<OrgProfile>(emptyOrgProfile());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('orgProfile');
    if (stored) setProfile(JSON.parse(stored));
  }, []);

  function removeFundingNeed(need: string) {
    setProfile((p) => ({ ...p, fundingNeeds: p.fundingNeeds.filter((n) => n !== need) }));
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    const response = await fetch('/api/funding', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? 'Something went wrong finding funding.');
      setSubmitting(false);
      return;
    }
    sessionStorage.setItem('fundingEstimate', JSON.stringify(body));
    router.push('/dashboard');
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-24">
      <div>
        <h1 className="text-2xl font-semibold">We found {profile.name || 'your organisation'}</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Review what we found before we start matching funding opportunities.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          value={profile.name}
          onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
        />
      </label>

      <div>
        <h2 className="mb-2 text-sm font-medium">Programs We Found</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {profile.programs.map((program) => (
            <li key={program}>
              <span aria-hidden>✓</span> <span>{program}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Potential Funding Needs</h2>
        <div className="flex flex-wrap gap-2">
          {profile.fundingNeeds.map((need) => (
            <Chip key={need} label={need} onRemove={() => removeFundingNeed(need)} />
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <p className="text-sm">{error}</p>
          <button
            type="button"
            className="pressable mt-3 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-accent-ink)]"
            onClick={handleConfirm}
          >
            Retry
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={submitting}
          onClick={handleConfirm}
          className="pressable rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 font-medium text-[var(--color-accent-ink)] disabled:opacity-60"
        >
          {submitting ? 'Finding funding…' : 'Looks Good — Find Funding'}
        </button>
      )}
    </main>
  );
}
