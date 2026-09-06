import type { Metadata } from 'next';
import Link from 'next/link';
import { getApiCallStats } from '@/lib/db';

export const metadata: Metadata = { title: 'Admin Dashboard' };

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

export default async function Page() {
  const stats = await getApiCallStats();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Cost and reliability of every provider the app calls, aggregated across all requests.
          </p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/admin/calls" className="underline">
            Call Log
          </Link>
          <Link href="/admin/errors" className="underline">
            Errors
          </Link>
          <Link href="/admin/clubs" className="underline">
            Clubs
          </Link>
        </nav>
      </div>

      {stats.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No API calls recorded yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="py-2">Provider</th>
              <th className="py-2">Total Calls</th>
              <th className="py-2">Total Cost</th>
              <th className="py-2">Avg Latency</th>
              <th className="py-2">Error Rate</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((row) => (
              <tr key={row.provider} className="border-b border-[var(--color-border)]">
                <td className="py-2">{row.provider}</td>
                <td className="py-2">{row.totalCalls}</td>
                <td className="py-2">{formatCost(row.totalCost)}</td>
                <td className="py-2">{Math.round(row.avgLatencyMs)}ms</td>
                <td className={`py-2 ${row.errorRate > 0.1 ? 'text-[var(--color-danger-ink)]' : ''}`}>
                  {(row.errorRate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
