'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { emptyOrgProfile, parseOrgProfile, type OrgProfile } from '@/lib/org-profile';
import { ErrorBanner } from '@/components/ErrorBanner';

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

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
      />
    </label>
  );
}

export default function ConfirmClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<OrgProfile>(emptyOrgProfile());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('orgProfile');
    if (!stored) return;
    try {
      setProfile(parseOrgProfile(JSON.parse(stored)));
    } catch {
      // Corrupted sessionStorage — keep the empty default form instead of crashing.
    }
  }, []);

  function removeFundingNeed(need: string) {
    setProfile((p) => ({ ...p, fundingNeeds: p.fundingNeeds.filter((n) => n !== need) }));
  }

  function removeAudience(segment: string) {
    setProfile((p) => ({ ...p, audience: p.audience.filter((a) => a !== segment) }));
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

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" value={profile.name} onChange={(v) => setProfile((p) => ({ ...p, name: v }))} />
        <TextField
          label="Location"
          value={profile.location}
          onChange={(v) => setProfile((p) => ({ ...p, location: v }))}
        />
        <TextField label="Sport" value={profile.sport} onChange={(v) => setProfile((p) => ({ ...p, sport: v }))} />
        <TextField
          label="Organisation Type"
          value={profile.organisationType}
          onChange={(v) => setProfile((p) => ({ ...p, organisationType: v }))}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Who You Serve</h2>
        <div className="flex flex-wrap gap-2">
          {profile.audience.map((segment) => (
            <Chip key={segment} label={segment} onRemove={() => removeAudience(segment)} />
          ))}
        </div>
      </div>

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
        <ErrorBanner message={error} onRetry={handleConfirm} />
      ) : (
        <div>
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className="pressable rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 font-medium text-[var(--color-accent-ink)] disabled:opacity-60"
          >
            {submitting ? 'Finding funding…' : 'Looks Good — Find Funding'}
          </button>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            This kicks off a real-time funding search — takes about 10 seconds.
          </p>
        </div>
      )}
    </main>
  );
}
