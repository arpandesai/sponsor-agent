import type { Metadata } from 'next';
import Link from 'next/link';
import { getApiCallErrors } from '@/lib/db';

export const metadata: Metadata = { title: 'Errors' };

export default async function Page() {
  const errors = await getApiCallErrors();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recent Errors</h1>
        <Link href="/admin" className="text-sm underline">
          Back to Dashboard
        </Link>
      </div>

      {errors.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No errors recorded — nice.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="py-2">Time</th>
              <th className="py-2">Provider</th>
              <th className="py-2">Endpoint / Model</th>
              <th className="py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((row) => (
              <tr key={row.id} className="border-b border-[var(--color-border)]">
                <td className="py-2">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="py-2">{row.provider}</td>
                <td className="py-2">{row.model ?? row.endpoint ?? '—'}</td>
                <td className="py-2 text-[var(--color-danger-ink)]">{row.errorMessage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
