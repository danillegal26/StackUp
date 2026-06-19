import { ChipAvatar } from './ChipAvatar';
import { formatChips } from '../lib/utils';
import { getAvatarImage } from '../lib/avatars';
import type { Player } from '../types';

interface Props {
  players: Player[]; // только активные — компонент сам сортирует по seat_index
  dealerPlayerId: string | null;
  smallBlind: number | null;
  bigBlind: number | null;
  pot?: number;
  highlightPlayerId?: string;
  turnPlayerId?: string | null;
}

// При ровно 2 игроках используется настоящее правило героз-апа: дилер — это
// малый блайнд и ходит первым. При 3+ игроках — обычная схема «по кругу
// после дилера» (см. также _begin_hand в 0006_betting.sql — там та же логика).
function getBlindSeats(sorted: Player[], dealerId: string | null) {
  if (!dealerId || sorted.length < 2) {
    return { sbId: null as string | null, bbId: null as string | null };
  }
  const dealerIdx = sorted.findIndex((p) => p.id === dealerId);
  if (dealerIdx === -1) return { sbId: null, bbId: null };
  if (sorted.length === 2) {
    const sb = sorted[dealerIdx];
    const bb = sorted[(dealerIdx + 1) % 2];
    return { sbId: sb.id, bbId: bb.id };
  }
  const sb = sorted[(dealerIdx + 1) % sorted.length];
  const bb = sorted[(dealerIdx + 2) % sorted.length];
  return { sbId: sb.id, bbId: bb.id };
}

// rx/ry держим заметно меньше 50%, чтобы карточка места (аватар + имя + стек,
// ~100-110px высотой) с учётом translate(-50%,-50%) гарантированно помещалась
// внутри контейнера при любом числе игроков и не вылезала за его границы —
// именно это раньше вызывало наложение верхнего места на заголовок «Раздача №N».
const RX = 34;
const RY = 32;

export function PokerTable({
  players,
  dealerPlayerId,
  smallBlind,
  bigBlind,
  pot = 0,
  highlightPlayerId,
  turnPlayerId,
}: Props) {
  const sorted = [...players].sort((a, b) => a.seat_index - b.seat_index);
  const { sbId, bbId } = getBlindSeats(sorted, dealerPlayerId);
  const n = sorted.length;

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-sm select-none py-2">
      {/* Зелёное сукно стола — отдельный фиксированный «table»-токен, не зависящий от темы оформления интерфейса */}
      <div
        className="absolute left-1/2 top-1/2 h-[58%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-table-glow/40 bg-table shadow-[0_0_36px_-6px_rgba(25,169,116,0.45)]"
        aria-hidden="true"
      />

      {/* Банк в центре */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ivory/60">Банк</p>
        <p className="font-mono text-2xl font-semibold tabular-nums text-brass-light">{formatChips(pot)}</p>
        {smallBlind != null && bigBlind != null && (
          <p className="mt-1 font-mono text-[10px] text-ivory/50">
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
        const left = 50 + RX * Math.cos(rad);
        const top = 50 + RY * Math.sin(rad);
        const isDealer = p.id === dealerPlayerId;
        const isSB = p.id === sbId;
        const isBB = p.id === bbId;
        const isMe = p.id === highlightPlayerId;
        const isTurn = turnPlayerId != null && p.id === turnPlayerId;
        const isFolded = p.hand_state === 'folded';
        const isAllIn = p.hand_state === 'all_in';

        return (
          <div
            key={p.id}
            className="absolute w-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <div
              className={`flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 backdrop-blur-sm transition ${
                isTurn
                  ? 'border-mint bg-mint/10 ring-2 ring-mint shadow-[0_0_14px_-2px_rgba(34,197,94,0.6)]'
                  : isMe
                    ? 'border-brass bg-brass/10 ring-1 ring-brass'
                    : 'border-hairline/10 bg-felt-light/80'
              } ${isFolded ? 'opacity-40' : ''}`}
            >
              <div className="relative">
                <ChipAvatar name={p.name} index={p.seat_index} size={44} avatar={getAvatarImage(p.avatar_id)} />
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
              {isFolded ? (
                <span className="rounded-full bg-hairline/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-muted">
                  Фолд
                </span>
              ) : isAllIn ? (
                <span className="rounded-full bg-clay/15 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-clay-light">
                  Олл-ин
                </span>
              ) : p.round_bet > 0 ? (
                <span className="rounded-full bg-mint/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-mint">
                  {formatChips(p.round_bet)}
                </span>
              ) : null}
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
          </div>
        );
      })}
    </div>
  );
}
