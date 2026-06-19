import { ChipAvatar } from './ChipAvatar';
import { formatChips } from '../lib/utils';
import type { PlayerResult } from '../types';

export function ResultsTable({ results }: { results: PlayerResult[] }) {
  const sorted = [...results].sort((a, b) => b.result - a.result);

  return (
    <div className="space-y-2">
      {sorted.map((r, i) => {
        const positive = r.result > 0;
        const negative = r.result < 0;
        return (
          <div
            key={r.player_id}
            className="flex items-center gap-3 rounded-xl border border-hairline/10 bg-hairline/[0.03] px-3 py-3"
          >
            <ChipAvatar name={r.name} index={i} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ivory">{r.name}</p>
              <p className="text-xs text-muted">
                Buy-in {formatChips(r.total_buyin)} · Стек {formatChips(r.current_stack)}
              </p>
            </div>
            <p
              className={`font-mono text-lg font-semibold tabular-nums ${
                positive ? 'text-brass-light' : negative ? 'text-clay-light' : 'text-muted'
              }`}
            >
              {positive ? '+' : ''}
              {formatChips(r.result)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
