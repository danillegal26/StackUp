import { useEffect, useRef, useState } from 'react';
import { ChipAvatar } from './ChipAvatar';
import { ChipStackIcon } from './ChipStackIcon';
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
  winAnnouncement?: { winnerIds: string[]; key: number } | null;
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

// Лёгкая анимация перелёта фишки между двумя точками стола: появляется в
// точке from и сразу же (на следующий тик) переезжает CSS-переходом в
// точку to, исчезая. Используется и для ставок (игрок → центр), и для
// выигрыша (центр → победитель) — направление просто меняется местами.
// Точки у каждого экземпляра свои, поэтому это обычный transition на
// инлайн-стилях, а не статичный keyframe в tailwind-конфиге.
function FlyingChip({
  from,
  to,
  big = false,
}: {
  from: { left: number; top: number };
  to: { left: number; top: number };
  big?: boolean;
}) {
  const [pos, setPos] = useState({ ...from, opacity: 1 });

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPos({ ...to, opacity: 0.1 }));
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const size = big ? 'h-4 w-4' : 'h-3 w-3';

  return (
    <div
      className={`pointer-events-none absolute z-10 ${size} -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass-light shadow-[0_0_8px_2px_rgba(245,158,11,0.7)] transition-all duration-700 ease-out`}
      style={{ left: `${pos.left}%`, top: `${pos.top}%`, opacity: pos.opacity }}
      aria-hidden="true"
    />
  );
}

export function PokerTable({
  players,
  dealerPlayerId,
  smallBlind,
  bigBlind,
  pot = 0,
  highlightPlayerId,
  turnPlayerId,
  winAnnouncement,
}: Props) {
  const sorted = [...players].sort((a, b) => a.seat_index - b.seat_index);
  const { sbId, bbId } = getBlindSeats(sorted, dealerPlayerId);
  const n = sorted.length;

  const prevBetsRef = useRef<Map<string, number>>(new Map());
  const [flights, setFlights] = useState<{ key: string; from: { left: number; top: number }; to: { left: number; top: number } }[]>([]);
  const [potPulse, setPotPulse] = useState(0);
  const [winFlights, setWinFlights] = useState<{ key: string; to: { left: number; top: number } }[]>([]);
  const [glowingIds, setGlowingIds] = useState<Set<string>>(new Set());
  const lastWinKeyRef = useRef<number | null>(null);

  // Засекаем рост round_bet у игрока между рендерами и запускаем для него
  // «перелёт фишки» к центру — стол выглядит живым при каждой ставке.
  useEffect(() => {
    const prev = prevBetsRef.current;
    const spawned: { key: string; from: { left: number; top: number }; to: { left: number; top: number } }[] = [];

    sorted.forEach((p, i) => {
      const angle = -90 + (360 / n) * i;
      const rad = (angle * Math.PI) / 180;
      const left = 50 + RX * Math.cos(rad);
      const top = 50 + RY * Math.sin(rad);
      const prevBet = prev.get(p.id) ?? 0;
      if (p.round_bet > prevBet) {
        spawned.push({ key: `${p.id}-${p.round_bet}-${Date.now()}`, from: { left, top }, to: { left: 50, top: 50 } });
      }
      prev.set(p.id, p.round_bet);
    });

    if (sorted.length > 0 && sorted.every((p) => p.round_bet === 0)) {
      prev.clear();
    }

    if (spawned.length > 0) {
      setFlights((f) => [...f, ...spawned]);
      setPotPulse((x) => x + 1);
      const timer = setTimeout(() => {
        setFlights((f) => f.filter((fl) => !spawned.some((s) => s.key === fl.key)));
      }, 750);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  // Анимация выигрыша: когда приходит новое winAnnouncement (другой key,
  // не тот же самый, что уже показывали), запускаем перелёт фишки от
  // центра к месту(-ам) победителя и на пару секунд подсвечиваем его
  // карточку золотым свечением.
  useEffect(() => {
    if (!winAnnouncement || winAnnouncement.key === lastWinKeyRef.current) return;
    lastWinKeyRef.current = winAnnouncement.key;

    const targets: { key: string; to: { left: number; top: number } }[] = [];
    sorted.forEach((p, i) => {
      if (!winAnnouncement.winnerIds.includes(p.id)) return;
      const angle = -90 + (360 / n) * i;
      const rad = (angle * Math.PI) / 180;
      targets.push({
        key: `win-${p.id}-${winAnnouncement.key}`,
        to: { left: 50 + RX * Math.cos(rad), top: 50 + RY * Math.sin(rad) },
      });
    });
    if (targets.length === 0) return;

    setWinFlights(targets);
    setGlowingIds(new Set(winAnnouncement.winnerIds));

    const flightTimer = setTimeout(() => setWinFlights([]), 800);
    const glowTimer = setTimeout(() => setGlowingIds(new Set()), 2600);
    return () => {
      clearTimeout(flightTimer);
      clearTimeout(glowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winAnnouncement?.key]);

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-sm select-none py-2">
      {/* Зелёное сукно стола — отдельный фиксированный «table»-токен, не зависящий от темы оформления интерфейса */}
      <div
        className="absolute left-1/2 top-1/2 h-[58%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-table-glow/40 bg-table shadow-[0_0_36px_-6px_rgba(25,169,116,0.45)]"
        aria-hidden="true"
      />

      {flights.map((f) => (
        <FlyingChip key={f.key} from={f.from} to={f.to} />
      ))}
      {winFlights.map((f) => (
        <FlyingChip key={f.key} from={{ left: 50, top: 50 }} to={f.to} big />
      ))}

      {/* Банк в центре */}
      <div className="absolute left-1/2 top-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 text-center">
        <div key={potPulse} className={`flex justify-center ${pot > 0 ? 'animate-chip-pulse' : ''}`}>
          <ChipStackIcon size={pot > 0 ? 30 : 22} />
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ivory/60">Банк</p>
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
        const isGlowing = glowingIds.has(p.id);

        return (
          <div
            key={p.id}
            className="absolute w-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <div
              className={`flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 backdrop-blur-sm transition ${
                isGlowing
                  ? 'border-brass bg-brass/15 ring-2 ring-brass-light shadow-[0_0_18px_-2px_rgba(245,158,11,0.7)]'
                  : isTurn
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
                <span className="flex items-center gap-1 rounded-full bg-mint/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-mint">
                  <ChipStackIcon size={9} />
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
                  {isSB && (
                    <span className="rounded-full bg-hairline/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-muted">
                      SB{smallBlind != null ? ` ${formatChips(smallBlind)}` : ''}
                    </span>
                  )}
                  {isBB && (
                    <span className="rounded-full bg-hairline/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-muted">
                      BB{bigBlind != null ? ` ${formatChips(bigBlind)}` : ''}
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
