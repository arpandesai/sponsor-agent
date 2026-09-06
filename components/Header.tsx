'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const STEPS: Record<string, number> = {
  '/analyze': 1,
  '/confirm': 2,
  '/dashboard': 3,
};
const TOTAL_STEPS = 3;

function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] text-xs font-bold text-[var(--color-accent-ink)]"
      >
        SF
      </span>
      SportsFirst
    </span>
  );
}

export function Header() {
  const pathname = usePathname();
  const step = STEPS[pathname];

  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 pt-8">
      <Link href="/" className="pressable">
        <Logo />
      </Link>
      <div className="flex items-center gap-4">
        {step ? (
          <span className="text-sm text-[var(--color-muted)]">
            Step {step} of {TOTAL_STEPS}
          </span>
        ) : null}
        {pathname !== '/' ? (
          <Link href="/" className="pressable text-sm text-[var(--color-muted)] underline">
            Start Over
          </Link>
        ) : null}
      </div>
    </header>
  );
}
