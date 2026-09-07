import type { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = {
  title: 'Funding opportunities',
};

export default function Page() {
  return <DashboardClient />;
}
