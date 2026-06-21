import { useEffect, useState } from 'react';
import { Button } from './ui';
import { ChipStackIcon } from './ChipStackIcon';
import { formatChips } from '../lib/utils';
import { translateError } from '../lib/errors';
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

// Индексы в палитру ChipStackIcon (0 красная / 1 зелёная / 2 чёрная / 3
// фиолетовая / 4 белая) — те же фишки, что и на столе, а не отдельный
// плоский стиль кнопки, как было раньше. Текст light/dark подобран под
// контраст с конкретным цветом фишки.
const CHIP_PRESETS = [
  { colorIndex: 0, text: 'text-paper' }, // красная
  { colorIndex: 1, text: 'text-paper' }, // зелёная
  { colorIndex: 3, text: 'text-paper' }, // фиолетовая — для самой крупной по умолчанию ставки (БАНК)
];

function ChipPreset({
  label,
  preset,
  onClick,
  disabled,
}: {
  label: string;
  preset: (typeof CHIP_PRESETS)[number];
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative flex h-12 w-12 shrink-0 items-center justify-center transition active:scale-95 disabled:opacity-30"
    >
      <ChipStackIcon size={48} count={1} colorIndex={preset.colorIndex} />
      <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold leading-tight drop-shadow-sm ${preset.text}`}>
        {label}
      </span>
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
      setError(translateError(err, 'Не удалось выполнить действие'));
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

      {/* На мобильном — всё в столбик, Олл-ин отдельной широкой кнопкой
          внизу (легче не промахнуться пальцем по самой весомой кнопке).
          На широком экране (md+) — три блока в один ряд: кнопки слева,
          ползунок суммы по центру, Олл-ин компактной кнопкой справа. */}
      <div className="space-y-3 md:flex md:items-start md:gap-4 md:space-y-0">
        <div className="grid grid-cols-3 gap-2 md:w-auto md:shrink-0">
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
        </div>

        {canRaise && (
          <div className="space-y-3 md:min-w-0 md:flex-1">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                {room.current_bet > 0 ? 'Сумма рейза' : 'Сумма ставки'}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-brass-light">
                {formatChips(raiseAmount)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline/15 text-lg text-ivory disabled:opacity-30"
                onClick={() => setPreset(raiseAmount - blindStep)}
                disabled={busy || raiseAmount <= minRaiseTo}
                aria-label="Уменьшить"
              >
                −
              </button>
              <input
                type="range"
                className="range-slider"
                min={minRaiseTo}
                max={maxTotal}
                step={blindStep}
                value={raiseAmount}
                disabled={busy}
                onChange={(e) => setPreset(Number(e.target.value))}
                aria-label={room.current_bet > 0 ? 'Сумма рейза' : 'Сумма ставки'}
              />
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline/15 text-lg text-ivory disabled:opacity-30"
                onClick={() => setPreset(raiseAmount + blindStep)}
                disabled={busy || raiseAmount >= maxTotal}
                aria-label="Увеличить"
              >
                +
              </button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <ChipPreset label="MIN" preset={CHIP_PRESETS[0]} disabled={busy} onClick={() => setPreset(minRaiseTo)} />
              <ChipPreset
                label="1/2"
                preset={CHIP_PRESETS[1]}
                disabled={busy}
                onClick={() => setPreset(room.current_bet + Math.round(room.pot / 2))}
              />
              <ChipPreset
                label="БАНК"
                preset={CHIP_PRESETS[2]}
                disabled={busy}
                onClick={() => setPreset(room.current_bet + room.pot)}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={busy || maxTotal <= 0}
          onClick={() => run('all_in')}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-brass/60 bg-coal px-4 py-2 text-sm font-semibold text-paper transition active:scale-[0.98] disabled:opacity-40 disabled:border-hairline/15 md:w-auto md:shrink-0 md:self-stretch"
        >
          Олл-ин
        </button>
      </div>
    </div>
  );
}
