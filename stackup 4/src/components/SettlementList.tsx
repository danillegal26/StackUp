import { formatChips } from '../lib/utils';
import { useT } from '../hooks/useLang';
import type { Transfer } from '../lib/settlement';

export function SettlementList({ transfers, unit }: { transfers: Transfer[]; unit?: string | null }) {
  const t = useT();

  if (transfers.length === 0) {
    return <p className="text-center text-sm text-muted">{t.noSettlement}</p>;
  }

  const suffix = unit ? ` ${unit}` : '';

  return (
    <div className="space-y-2">
      {transfers.map((tr, i) => (
        <div
          key={`${tr.fromId}-${tr.toId}-${i}`}
          className="flex items-center gap-3 rounded-xl border border-hairline/10 bg-hairline/[0.03] px-3 py-3"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-ivory">{tr.fromName}</span>
          <span className="shrink-0 text-xs text-muted">{t.pays}</span>
          <span className="min-w-0 flex-1 truncate text-right text-sm text-ivory">{tr.toName}</span>
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-brass-light">
            {formatChips(tr.amount)}{suffix}
          </span>
        </div>
      ))}
    </div>
  );
}
