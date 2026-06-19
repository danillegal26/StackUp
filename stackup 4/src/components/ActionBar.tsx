import { useEffect, useState } from 'react';
import { Button } from './ui';
import { formatChips } from '../lib/utils';
import type { Player, Room } from '../types';
import type { PlayerActionType } from '../lib/roomApi';

interface Props {
  room: Room;
  me: Player;
  onAction: (action: PlayerActionType, amount?: number) => Promise<void>;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function ActionBar({ room, me, onAction }: Props) {
  const callAmount = Math.max(0, room.current_bet - me.round_bet);
  const canCheck = callAmount === 0;
  const maxTotal = me.round_bet + me.current_stack;
  const blindStep = Math.max(1, room.big_blind ?? 1);
  const minRaiseTo = Math.min(
    maxTotal,
    room.current_bet > 0 ? room.current_bet + Math.max(room.big_blind ?? room.current_bet, 1) : blindStep
  );
  const canRaise = maxTotal > room.current_bet;

  const [raiseAmount, setRaiseAmount] = useState(minRaiseTo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Сбрасываем выбранную сумму на минимально легальный рейз при каждом
  // новом ходе — иначе останется значение от прошлого круга торгов.
  useEffect(() => {
    setRaiseAmount(minRaiseTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.turn_player_id, room.current_bet]);

  async function run(action: PlayerActionType, amount?: number) {
    setBusy(true);
    setError(null);
    try {
      await onAction(action, amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить действие');
    } finally {
      setBusy(false);
    }
  }

  function setPreset(value: number) {
    setRaiseAmount(clamp(value, minRaiseTo, maxTotal));
  }

  const isAllIn = raiseAmount >= maxTotal;

  return (
    <div className="space-y-3 rounded-2xl border border-hairline/10 bg-felt-light/80 p-4 backdrop-blur-sm">
      {error && <p className="text-center text-xs text-clay-light">{error}</p>}

      <div className="grid grid-cols-3 gap-2">
        <Button variant="danger" disabled={busy} onClick={() => run('fold')}>
          Пас
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => run(canCheck ? 'check' : 'call')}>
          {canCheck ? 'Чек' : `Колл ${formatChips(callAmount)}`}
        </Button>
        <Button
          disabled={busy || !canRaise}
          onClick={() => run(isAllIn ? 'all_in' : room.current_bet > 0 ? 'raise' : 'bet', raiseAmount)}
        >
          {isAllIn ? 'Олл-ин' : room.current_bet > 0 ? `Рейз до ${formatChips(raiseAmount)}` : `Ставка ${formatChips(raiseAmount)}`}
        </Button>
      </div>

      {canRaise && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-hairline/15 text-lg text-ivory disabled:opacity-30"
              onClick={() => setPreset(raiseAmount - blindStep)}
              disabled={busy || raiseAmount <= minRaiseTo}
              aria-label="Уменьшить"
            >
              −
            </button>
            <div className="flex-1 rounded-lg border border-hairline/15 bg-felt-deep/60 py-2 text-center font-mono text-lg tabular-nums text-ivory">
              {formatChips(raiseAmount)}
            </div>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-hairline/15 text-lg text-ivory disabled:opacity-30"
              onClick={() => setPreset(raiseAmount + blindStep)}
              disabled={busy || raiseAmount >= maxTotal}
              aria-label="Увеличить"
            >
              +
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPreset(room.current_bet + Math.round(room.pot / 2))}>
              1/2 банка
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPreset(room.current_bet + room.pot)}>
              Банк
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPreset(maxTotal)}>
              Олл-ин
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
