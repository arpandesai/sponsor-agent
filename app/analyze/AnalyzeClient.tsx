'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { OrgProfile } from '@/lib/org-profile';
import { ErrorBanner } from '@/components/ErrorBanner';

const NAVIGATE_DELAY_MS = 900;

export default function AnalyzeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = searchParams.get('url') ?? '';
  const [steps, setSteps] = useState<string[]>([]);
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) return;
    setSteps([]);
    setProfile(null);
    setError(null);

    const source = new EventSource(`/api/analyze?url=${encodeURIComponent(url)}`);
    let navigateTimer: ReturnType<typeof setTimeout> | undefined;

    source.addEventListener('step', (event) => {
      const { label } = JSON.parse((event as MessageEvent).data);
      setSteps((prev) => [...prev, label]);
    });

    source.addEventListener('done', (event) => {
      const result = JSON.parse((event as MessageEvent).data);
      setProfile(result);
      sessionStorage.setItem('orgProfile', JSON.stringify(result));
      source.close();
      // Brief pause so the checklist and preview are actually visible before moving on.
      navigateTimer = setTimeout(() => router.push('/confirm'), NAVIGATE_DELAY_MS);
    });

    source.addEventListener('error', (event) => {
      const messageEvent = event as MessageEvent;
      const message = messageEvent.data ? JSON.parse(messageEvent.data).error : 'Something went wrong.';
      setError(message);
      source.close();
    });

    return () => {
      source.close();
      if (navigateTimer) clearTimeout(navigateTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router.push identity is unstable under test mocks; url/attempt alone should retrigger the connection
  }, [url, attempt]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-24 sm:flex-row sm:items-start">
      <div className="flex flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Understanding your organisation</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Reading your website and identifying key details — this takes about 20 seconds.
          </p>
        </div>

        {error ? (
          <ErrorBanner message={error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : (
          <ul className="flex flex-col gap-2">
            {steps.map((label, i) => (
              <li
                key={label}
                className="fade-in-up flex items-center gap-2 text-sm"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span aria-hidden>✓</span>
                {label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {profile ? (
        <aside className="fade-in-up w-full max-w-xs rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 sm:w-64">
          <p className="font-semibold">{profile.name}</p>
          {profile.location ? <p className="text-sm text-[var(--color-muted)]">{profile.location}</p> : null}
          {profile.sport ? <p className="mt-2 text-sm">{profile.sport}</p> : null}
          {profile.audience.length > 0 ? (
            <p className="text-sm text-[var(--color-muted)]">{profile.audience.join(' + ')}</p>
          ) : null}
          {profile.organisationType ? <p className="mt-2 text-sm">{profile.organisationType}</p> : null}
        </aside>
      ) : null}
    </main>
  );
}
