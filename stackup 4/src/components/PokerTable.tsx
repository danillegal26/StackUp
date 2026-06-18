import { ChipAvatar } from './ChipAvatar';
import { formatChips } from '../lib/utils';
import type { Player } from '../types';

interface Props {
  players: Player[]; // только активные — компонент сам сортирует по seat_index
  dealerPlayerId: string | null;
  smallBlind: number | null;
  bigBlind: number | null;
  pot?: number;
  highlightPlayerId?: string;
}

function getBlindSeats(sorted: Player[], dealerId: string | null) {
  if (!dealerId || sorted.length < 2) {
    return { sbId: null as string | null, bbId: null as string | null };
  }
  const dealerIdx = sorted.findIndex((p) => p.id === dealerId);
  if (dealerIdx === -1) return { sbId: null, bbId: null };
  const sb = sorted[(dealerIdx + 1) % sorted.length];
  const bb = sorted[(dealerIdx + 2) % sorted.length];
  return { sbId: sb.id, bbId: bb.id };
}

export function PokerTable({ players, dealerPlayerId, smallBlind, bigBlind, pot = 0, highlightPlayerId }: Props) {
  const sorted = [...players].sort((a, b) => a.seat_index - b.seat_index);
  const { sbId, bbId } = getBlindSeats(sorted, dealerPlayerId);
  const n = sorted.length;

  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-sm select-none">
      {/* Сукно стола */}
      <div className="absolute left-1/2 top-1/2 h-[50%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 border-brass/25 bg-felt-light/40 shadow-inner" />

      {/* Банк в центре */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Банк</p>
        <p className="font-mono text-2xl font-semibold tabular-nums text-brass-light">{formatChips(pot)}</p>
        {smallBlind != null && bigBlind != null && (
          <p className="mt-1 font-mono text-[10px] text-muted">
            {formatChips(smallBlind)}/{formatChips(bigBlind)}
          </p>
        )}
      </div>

      {n === 0 && (
        <p className="absolute left-1/2 top-[78%] w-full -translate-x-1/2 text-center text-sm text-muted">
          За столом пока никого нет
        </p>
      )}

      {sorted.map((p, i) => {
        const angle = -90 + (360 / n) * i;
        const rad = (angle * Math.PI) / 180;
        const rx = 45;
        const ry = 47;
        const left = 50 + rx * Math.cos(rad);
        const top = 50 + ry * Math.sin(rad);
        const isDealer = p.id === dealerPlayerId;
        const isSB = p.id === sbId;
        const isBB = p.id === bbId;
        const isMe = p.id === highlightPlayerId;

        return (
          <div
            key={p.id}
            className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <div className="relative">
              <ChipAvatar name={p.name} index={p.seat_index} size={48} />
              {isDealer && (
                <span
                  aria-label="Дилер"
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-coal/20 bg-paper text-[10px] font-bold text-coal"
                >
                  D
                </span>
              )}
            </div>
            <p className={`max-w-full truncate text-center text-xs ${isMe ? 'font-semibold text-brass-light' : 'text-ivory'}`}>
              {p.name}
              {isMe ? ' (вы)' : ''}
            </p>
            <p className="font-mono text-xs tabular-nums text-muted">{formatChips(p.current_stack)}</p>
            {(p.is_host || isSB || isBB) && (
              <div className="flex flex-wrap items-center justify-center gap-1">
                {p.is_host && (
                  <span className="rounded-full bg-brass/15 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-brass-light">
                    host
                  </span>
                )}
                {(isSB || isBB) && (
                  <span className="rounded-full bg-hairline/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-muted">
                    {isSB ? 'SB' : 'BB'}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
