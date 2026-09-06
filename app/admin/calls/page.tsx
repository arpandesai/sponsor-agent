import type { Metadata } from 'next';
import Link from 'next/link';
import { getApiCallLogs } from '@/lib/db';

export const metadata: Metadata = { title: 'Call Log' };

function formatCost(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(6)}`;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const provider = params.provider;
  const status = params.status === 'success' || params.status === 'error' ? params.status : undefined;

  const logs = await getApiCallLogs({ provider, status, page });

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Call Log</h1>
        <Link href="/admin" className="text-sm underline">
          Back to Dashboard
        </Link>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No calls found.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="py-2">Time</th>
              <th className="py-2">Provider</th>
              <th className="py-2">Endpoint / Model</th>
              <th className="py-2">Status</th>
              <th className="py-2">Latency</th>
              <th className="py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((row) => (
              <tr key={row.id} className="border-b border-[var(--color-border)]">
                <td className="py-2">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="py-2">{row.provider}</td>
                <td className="py-2">{row.model ?? row.endpoint ?? '—'}</td>
                <td className="py-2">{row.status}</td>
                <td className="py-2">{row.latencyMs}ms</td>
                <td className="py-2">{formatCost(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
