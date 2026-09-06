'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  const [url, setUrl] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        Find more funding for your sports organisation
      </h1>
      <p className="text-lg text-[var(--color-muted)]">
        AI-powered sponsorship and grant discovery built for clubs, leagues, federations and academies.
      </p>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
        <label htmlFor="org-url" className="text-left text-sm font-medium">
          Enter your organisation website
        </label>
        <input
          id="org-url"
          aria-label="Enter your organisation website"
          type="url"
          required
          placeholder="https://yourclub.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-base"
        />
        <button
          type="submit"
          className="pressable rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 font-medium text-[var(--color-accent-ink)]"
        >
          Find Funding Opportunities
        </button>
        <p className="text-sm text-[var(--color-muted)]">No setup required. Start with your website.</p>
      </form>

      <div className="mt-12 grid w-full gap-4 sm:grid-cols-2">
        <article className="fade-in-up rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 text-left">
          <h2 className="font-semibold">Sponsor Agent</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Find companies likely to sponsor your organisation and create personalised outreach.
          </p>
        </article>
        <article
          className="fade-in-up rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 text-left"
          style={{ animationDelay: '60ms' }}
        >
          <h2 className="font-semibold">Grant Agent</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Discover relevant grants, check eligibility and prepare applications.
          </p>
        </article>
      </div>
    </main>
  );
}
