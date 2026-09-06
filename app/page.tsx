import type { Metadata } from 'next';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: 'Find funding for your sports organisation',
};

export default function Page() {
  return <HomeClient />;
}
