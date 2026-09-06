'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = searchParams.get('url') ?? '';
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) return;
    setSteps([]);
    setError(null);

    const source = new EventSource(`/api/analyze?url=${encodeURIComponent(url)}`);

    source.addEventListener('step', (event) => {
      const { label } = JSON.parse((event as MessageEvent).data);
      setSteps((prev) => [...prev, label]);
    });

    source.addEventListener('done', (event) => {
      const profile = JSON.parse((event as MessageEvent).data);
      sessionStorage.setItem('orgProfile', JSON.stringify(profile));
      source.close();
      router.push('/confirm');
    });

    source.addEventListener('error', (event) => {
      const messageEvent = event as MessageEvent;
      const message = messageEvent.data ? JSON.parse(messageEvent.data).error : 'Something went wrong.';
      setError(message);
      source.close();
    });

    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router.push identity is unstable under test mocks; url/attempt alone should retrigger the connection
  }, [url, attempt]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">Understanding your organisation</h1>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <p className="text-sm">{error}</p>
          <button
            className="pressable mt-3 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-accent-ink)]"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry
          </button>
        </div>
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
    </main>
  );
}
