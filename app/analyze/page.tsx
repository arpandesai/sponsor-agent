import type { Metadata } from 'next';
import AnalyzeClient from './AnalyzeClient';

export const metadata: Metadata = {
  title: 'Understanding your organisation',
};

export default function Page() {
  return <AnalyzeClient />;
}
