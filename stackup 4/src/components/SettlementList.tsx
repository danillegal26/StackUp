import { formatChips } from '../lib/utils';
import type { Transfer } from '../lib/settlement';

export function SettlementList({ transfers, currency }: { transfers: Transfer[]; currency?: string | null }) {
  if (transfers.length === 0) {
    return <p className="text-center text-sm text-muted">Переводов не требуется — все при своих.</p>;
  }

  const unit = currency ? ` ${currency}` : '';

  return (
    <div className="space-y-2">
      {transfers.map((t, i) => (
        <div
          key={`${t.fromId}-${t.toId}-${i}`}
          className="flex items-center gap-3 rounded-xl border border-hairline/10 bg-hairline/[0.03] px-3 py-3"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-ivory">{t.fromName}</span>
          <span className="shrink-0 text-muted" aria-hidden="true">
            →
          </span>
          <span className="min-w-0 flex-1 truncate text-right text-sm text-ivory">{t.toName}</span>
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-brass-light">
            {formatChips(t.amount)}
            {unit}
          </span>
        </div>
      ))}
      <p className="pt-1 text-center text-xs text-muted">Всего переводов: {transfers.length}</p>
    </div>
  );
}
