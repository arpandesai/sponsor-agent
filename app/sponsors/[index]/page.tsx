import type { Metadata } from 'next';
import SponsorDetailClient from './SponsorDetailClient';

export const metadata: Metadata = { title: 'Sponsor Detail' };

export default function Page() {
  return <SponsorDetailClient />;
}
