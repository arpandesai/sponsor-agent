'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function PitchClient() {
  const router = useRouter();
  const params = useParams<{ index: string }>();
  const index = Number(params.index);
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const profileStored = sessionStorage.getItem('orgProfile');
    const sponsorListStored = sessionStorage.getItem('sponsorList');
    if (!profileStored || !sponsorListStored) {
      router.push('/sponsors');
      return;
    }

    let sponsor;
    try {
      sponsor = JSON.parse(sponsorListStored)[index];
    } catch {
      sponsor = undefined;
    }
    if (!sponsor) {
      router.push('/sponsors');
      return;
    }

    setSponsorName(sponsor.name);
    setSubject(null);
    setError(null);

    (async () => {
      const response = await fetch('/api/pitch', {
        method: 'POST',
        body: JSON.stringify({ profile: JSON.parse(profileStored), sponsor }),
      });
      const draft = await response.json();
      if (!response.ok) {
        setError(draft.error ?? 'Something went wrong drafting a pitch.');
        return;
      }
      setSubject(draft.subject);
      setBody(draft.body);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router.push identity is unstable under test mocks; index/attempt alone should retrigger the fetch
  }, [index, attempt]);

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-24">
      <div>
        <h1 className="text-2xl font-semibold">Your pitch draft{sponsorName ? ` for ${sponsorName}` : ''}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          This is a draft only — no email is sent. Edit it, then copy it out to send yourself.
        </p>
      </div>

      {error ? (
        <ErrorBanner message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : subject === null ? (
        <div role="status" aria-label="Thinking" className="flex items-center gap-1.5 py-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:300ms]" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <label>Subject</label>
              <button type="button" onClick={() => copy(subject)} className="pressable text-xs underline">
                Copy Subject
              </button>
            </div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <label>Body</label>
              <button type="button" onClick={() => copy(body)} className="pressable text-xs underline">
                Copy Body
              </button>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
            />
          </div>
        </>
      )}
    </main>
  );
}
