import type { Metadata } from 'next';
import SponsorsClient from './SponsorsClient';

export const metadata: Metadata = { title: 'Sponsors' };

export default function Page() {
  return <SponsorsClient />;
}
