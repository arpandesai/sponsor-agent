import type { Metadata } from 'next';
import Link from 'next/link';
import { getClubsOverview, getDiscoveryRunsForClub } from '@/lib/db';

export const metadata: Metadata = { title: 'Clubs' };

export default async function Page() {
  const clubs = await getClubsOverview();
  const runsByClub = await Promise.all(clubs.map((club) => getDiscoveryRunsForClub(club.id)));

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clubs</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Clubs that have run through the sponsor agent, and their discovery history.
          </p>
        </div>
        <Link href="/admin" className="text-sm underline">
          Back to Dashboard
        </Link>
      </div>

      {clubs.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No clubs analyzed yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {clubs.map((club, index) => (
            <article key={club.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6">
              <p className="font-semibold">{club.name}</p>
              <p className="text-sm text-[var(--color-muted)]">
                {club.sport} · {[club.city, club.region, club.country].filter(Boolean).join(', ') || 'Location unknown'}
              </p>
              <p className="mt-2 text-sm">
                {club.matchCount} sponsor matches · {club.relationshipCount} confirmed relationships
              </p>

              {runsByClub[index].length > 0 ? (
                <ul className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-muted)]">
                  {runsByClub[index].map((run, runIndex) => (
                    <li key={runIndex}>
                      {new Date(run.startedAt).toLocaleString()} — {run.runType} ({run.status}): {run.candidatesFound} found,{' '}
                      {run.candidatesQualified} qualified
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
