import { useEffect, useState } from 'react';
import { Button } from './ui';
import { formatChips } from '../lib/utils';
import type { Player, Room } from '../types';
import type { PlayerActionType } from '../lib/roomApi';

interface Props {
  room: Room;
  me: Player;
  secondsLeft?: number | null;
  onAction: (action: PlayerActionType, amount?: number) => Promise<void>;
}

const TURN_SECONDS = 25; // должно совпадать с интервалом в check_timeout/_begin_hand на сервере

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const CHIP_PRESETS = [
  { bg: 'bg-clay', edge: 'border-clay-light/70 text-paper' },
  { bg: 'bg-brass', edge: 'border-brass-light/70 text-coal' },
  { bg: 'bg-mint', edge: 'border-mint-light/70 text-coal' },
];

function ChipPreset({
  label,
  color,
  onClick,
  disabled,
}: {
  label: string;
  color: (typeof CHIP_PRESETS)[number];
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-2 border-dashed text-[10px] font-bold leading-tight shadow-sm transition active:scale-95 disabled:opacity-30 ${color.bg} ${color.edge}`}
    >
      {label}
    </button>
  );
}

export function ActionBar({ room, me, secondsLeft, onAction }: Props) {
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

  return (
    <div className="space-y-3 rounded-2xl border border-hairline/10 bg-felt-light/80 p-4 backdrop-blur-sm">
      {secondsLeft != null && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline/10">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                secondsLeft <= 7 ? 'bg-clay' : 'bg-mint'
              }`}
              style={{ width: `${clamp((secondsLeft / TURN_SECONDS) * 100, 0, 100)}%` }}
            />
          </div>
          <span className={`shrink-0 font-mono text-xs tabular-nums ${secondsLeft <= 7 ? 'text-clay-light' : 'text-muted'}`}>
            {secondsLeft}с
          </span>
        </div>
      )}

      {error && <p className="text-center text-xs text-clay-light">{error}</p>}

      <div className="grid grid-cols-4 gap-2">
        <Button variant="danger" size="sm" disabled={busy} onClick={() => run('fold')}>
          Пас
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(canCheck ? 'check' : 'call')}>
          {canCheck ? 'Чек' : `Колл ${formatChips(callAmount)}`}
        </Button>
        <Button
          size="sm"
          disabled={busy || !canRaise}
          onClick={() => run(room.current_bet > 0 ? 'raise' : 'bet', raiseAmount)}
        >
          {room.current_bet > 0 ? `Рейз ${formatChips(raiseAmount)}` : `Ставка ${formatChips(raiseAmount)}`}
        </Button>
        <button
          type="button"
          disabled={busy || maxTotal <= 0}
          onClick={() => run('all_in')}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-coal px-2 py-2 text-xs font-semibold text-paper transition active:scale-[0.98] disabled:opacity-40"
        >
          Олл-ин
        </button>
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

          <div className="flex items-center justify-center gap-3">
            <ChipPreset label="MIN" color={CHIP_PRESETS[0]} disabled={busy} onClick={() => setPreset(minRaiseTo)} />
            <ChipPreset
              label="1/2"
              color={CHIP_PRESETS[1]}
              disabled={busy}
              onClick={() => setPreset(room.current_bet + Math.round(room.pot / 2))}
            />
            <ChipPreset
              label="БАНК"
              color={CHIP_PRESETS[2]}
              disabled={busy}
              onClick={() => setPreset(room.current_bet + room.pot)}
            />
          </div>
        </>
      )}
    </div>
  );
}
