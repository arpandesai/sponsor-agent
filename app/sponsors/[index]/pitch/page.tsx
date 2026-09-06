import type { Metadata } from 'next';
import PitchClient from './PitchClient';

export const metadata: Metadata = { title: 'Pitch Builder' };

export default function Page() {
  return <PitchClient />;
}
