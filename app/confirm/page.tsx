import type { Metadata } from 'next';
import ConfirmClient from './ConfirmClient';

export const metadata: Metadata = {
  title: 'Confirm your organisation',
};

export default function Page() {
  return <ConfirmClient />;
}
