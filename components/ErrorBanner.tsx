export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-4"
    >
      <span aria-hidden className="text-[var(--color-danger-ink)]">
        ⚠
      </span>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--color-danger-ink)]">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="pressable self-start rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-accent-ink)]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
