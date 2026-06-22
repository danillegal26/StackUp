import { ChipAvatar } from './ChipAvatar';
import { formatChips } from '../lib/utils';
import { useT } from '../hooks/useLang';
import type { PlayerResult } from '../types';

interface Props {
  results: PlayerResult[];
  moneyPerChip?: number | null;
  currency?: string | null;
}

export function ResultsTable({ results, moneyPerChip, currency }: Props) {
  const t = useT();
  const sorted = [...results].sort((a, b) => b.result - a.result);

  return (
    <div className="space-y-2">
      {sorted.map((r, i) => {
        const positive = r.result > 0;
        const negative = r.result < 0;
        const moneyResult = moneyPerChip ? Math.round(r.result * moneyPerChip) : null;
        return (
          <div
            key={r.player_id}
            className="flex items-center gap-3 rounded-xl border border-hairline/10 bg-hairline/[0.03] px-3 py-3"
          >
            <ChipAvatar name={r.name} index={i} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ivory">{r.name}</p>
              <p className="text-xs text-muted">
                Buy-in {formatChips(r.total_buyin)} · {t.stackBtn} {formatChips(r.current_stack)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={`font-mono text-lg font-semibold tabular-nums ${
                  positive ? 'text-brass-light' : negative ? 'text-clay-light' : 'text-muted'
                }`}
              >
                {positive ? '+' : ''}{formatChips(r.result)}
              </p>
              {moneyResult !== null && (
                <p className="font-mono text-xs tabular-nums text-muted">
                  ≈ {moneyResult > 0 ? '+' : ''}{moneyResult}{currency ? ` ${currency}` : ''}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
