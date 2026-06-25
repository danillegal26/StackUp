import { Fragment, memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChipAvatar } from './ChipAvatar';
import { ChipStackIcon } from './ChipStackIcon';
import { CommunityCardSlots } from './CommunityCardSlots';
import { formatChips } from '../lib/utils';
import { getAvatarImage } from '../lib/avatars';
import { useT } from '../hooks/useLang';
import type { HandStage, Player, Street } from '../types';

interface Props {
  players: Player[]; // только активные — компонент сам сортирует по seat_index
  dealerPlayerId: string | null;
  smallBlind: number | null;
  bigBlind: number | null;
  pot?: number;
  highlightPlayerId?: string;
  turnPlayerId?: string | null;
  winAnnouncement?: { winnerIds: string[]; key: number } | null;
  handStage?: HandStage;
  street?: Street;
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
const RY = 34;
const PILE_T = 0.46; // доля пути от места игрока к центру, где лежит его стопка фишек на столе
const MAX_PILE_LAYERS = 5; // меньше, чем раньше — новые фишки выше (полный круг вместо приплюснутого овала), компенсируем числом слоёв

const ACTION_KEYS: Record<string, keyof ReturnType<typeof useT>> = {
  fold: 'actionFold',
  check: 'actionCheck',
  call: 'actionCall',
  bet: 'actionBet',
  raise: 'actionRaise',
  all_in: 'actionAllIn',
};

function seatPos(i: number, n: number) {
  const angle = -90 + (360 / n) * i;
  const rad = (angle * Math.PI) / 180;
  return { left: 50 + RX * Math.cos(rad), top: 50 + RY * Math.sin(rad) };
}

// Стол поворачивается так, чтобы СВОЁ место всегда было внизу экрана —
// ближе к зрителю, как за настоящим столом, а не где попало по
// seat_index. На дилера/блайнды/всю игровую логику это не влияет —
// она по-прежнему считается по реальному seat_index, это чисто
// перестановка ТОЛЬКО для отрисовки позиций на экране.
function visualSeatIndex(i: number, n: number, meIndex: number): number {
  if (meIndex < 0) return i;
  return (((i - meIndex + n) % n) + Math.floor(n / 2)) % n;
}

// Перелёт фишки по дуге между двумя точками стола (а не по прямой) — у
// keyframe-а в tailwind.config.js свои from/mid/to координаты на каждый
// экземпляр через CSS custom properties, потому что обычный tailwind
// keyframe статичен и не может знать заранее, откуда и куда летит
// конкретная фишка. mid — середина пути, чуть приподнятая (меньше top =
// выше на экране), чтобы получилась настоящая дуга броска, а не
// скольжение по прямой. Вращение и лёгкий bounce-масштаб на излёте
// зашиты в сам keyframe (см. chip-arc). delayMs даёт пачке из нескольких
// фишек (см. бёрст при ставке) разлететься не идеально синхронно, а с
// небольшим нахлёстом — так пачка читается как несколько фишек, а не
// один сдвоенный объект.
function FlyingChip({
  from,
  to,
  big = false,
  delayMs = 0,
}: {
  from: { left: number; top: number };
  to: { left: number; top: number };
  big?: boolean;
  delayMs?: number;
}) {
  const t = useT();
  const midLeft = (from.left + to.left) / 2;
  const dist = Math.hypot(to.left - from.left, to.top - from.top);
  const archHeight = Math.min(15, Math.max(5, dist * 0.22));
  const midTop = (from.top + to.top) / 2 - archHeight;

  const style = {
    '--chip-from-left': `${from.left}%`,
    '--chip-from-top': `${from.top}%`,
    '--chip-mid-left': `${midLeft}%`,
    '--chip-mid-top': `${midTop}%`,
    '--chip-to-left': `${to.left}%`,
    '--chip-to-top': `${to.top}%`,
    left: `${from.left}%`,
    top: `${from.top}%`,
    animationDelay: `${delayMs}ms`,
  } as CSSProperties;

  return (
    <div
      className="pointer-events-none absolute z-10 animate-chip-arc drop-shadow-[0_0_6px_rgba(245,158,11,0.55)]"
      style={style}
      aria-hidden="true"
    >
      <ChipStackIcon size={big ? 22 : 16} count={1} />
    </div>
  );
}

export const PokerTable = memo(function PokerTable({
  players,
  dealerPlayerId,
  smallBlind,
  bigBlind,
  pot = 0,
  highlightPlayerId,
  turnPlayerId,
  winAnnouncement,
  handStage,
  street,
}: Props) {
  const sorted = [...players].sort((a, b) => a.seat_index - b.seat_index);
  const { sbId, bbId } = getBlindSeats(sorted, dealerPlayerId);
  const n = sorted.length;
  const meIndex = highlightPlayerId ? sorted.findIndex((p) => p.id === highlightPlayerId) : -1;

  const prevBetsRef = useRef<Map<string, number>>(new Map());
  const prevActionsRef = useRef<Map<string, string | null>>(new Map());
  const [flights, setFlights] = useState<
    { key: string; from: { left: number; top: number }; to: { left: number; top: number }; delayMs: number }[]
  >([]);
  const [potPulse, setPotPulse] = useState(0);
  const [winFlights, setWinFlights] = useState<{ key: string; to: { left: number; top: number } }[]>([]);
  const [glowingIds, setGlowingIds] = useState<Set<string>>(new Set());
  const [actionBubbles, setActionBubbles] = useState<{ key: string; playerId: string; label: string }[]>([]);
  const lastWinKeyRef = useRef<number | null>(null);

  // Засекаем рост round_bet у игрока между рендерами и запускаем для него
  // «перелёт фишек» к центру — пара-тройка фишек срываются со стопки
  // игрока на столе и едут в банк, а не один кружок. Стол выглядит живым
  // при каждой ставке.
  useEffect(() => {
    const prev = prevBetsRef.current;
    const spawned: {
      key: string;
      from: { left: number; top: number };
      to: { left: number; top: number };
      delayMs: number;
    }[] = [];

    sorted.forEach((p, i) => {
      const seat = seatPos(visualSeatIndex(i, n, meIndex), n);
      const pile = { left: seat.left + (50 - seat.left) * PILE_T, top: seat.top + (50 - seat.top) * PILE_T };
      const prevBet = prev.get(p.id) ?? 0;
      if (p.round_bet > prevBet) {
        for (let j = 0; j < 3; j++) {
          const jitter = (j - 1) * 4.5;
          spawned.push({
            key: `${p.id}-${p.round_bet}-${Date.now()}-${j}`,
            from: { left: pile.left + jitter, top: pile.top + jitter * 0.6 },
            to: { left: 50, top: 50 },
            delayMs: j * 70,
          });
        }
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
      }, 820);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  // Засекаем смену last_action у игрока и на пару секунд показываем
  // короткую подпись над его местом («Чек»/«Колл»/«Рейз»/...) — Check
  // не двигает фишки, поэтому отдельной меткой с сервера его никак не
  // отличить от «ничего не произошло» по дельте остальных полей.
  useEffect(() => {
    const prev = prevActionsRef.current;
    const spawned: { key: string; playerId: string; label: string }[] = [];

    sorted.forEach((p) => {
      const prevAction = prev.get(p.id);
      if (p.last_action && p.last_action !== prevAction && ACTION_KEYS[p.last_action]) {
        const key = ACTION_KEYS[p.last_action] as keyof typeof t;
        const label = typeof t[key] === 'string' ? (t[key] as string) : p.last_action;
        spawned.push({ key: `${p.id}-${p.last_action}-${Date.now()}`, playerId: p.id, label });
      }
      prev.set(p.id, p.last_action);
    });

    if (spawned.length > 0) {
      setActionBubbles((b) => [...b, ...spawned]);
      const timer = setTimeout(() => {
        setActionBubbles((b) => b.filter((bub) => !spawned.some((s) => s.key === bub.key)));
      }, 1800);
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
      targets.push({ key: `win-${p.id}-${winAnnouncement.key}`, to: seatPos(visualSeatIndex(i, n, meIndex), n) });
    });
    if (targets.length === 0) return;

    setWinFlights(targets);
    setGlowingIds(new Set(winAnnouncement.winnerIds));

    const flightTimer = setTimeout(() => setWinFlights([]), 1000);
    const glowTimer = setTimeout(() => setGlowingIds(new Set()), 2600);
    return () => {
      clearTimeout(flightTimer);
      clearTimeout(glowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winAnnouncement?.key]);

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-sm select-none py-2 md:max-w-md">
      {/* Рейл стола — тёплый деревянный градиент (не плоский уголь), с тонкой латунной окантовкой поверх, под зелёным сукном */}
      <div
        className="absolute left-1/2 top-1/2 h-[76%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55)]"
        style={{ background: 'radial-gradient(ellipse at 50% 28%, #6B4A2E 0%, #4A3119 48%, #2A1A0C 78%, #1A0F06 100%)' }}
        aria-hidden="true"
      />
      <div
        className="absolute left-1/2 top-1/2 h-[73.5%] w-[77.5%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-brass/40"
        aria-hidden="true"
      />
      {/* Зелёное сукно стола — радиальный градиент (светлее в центре, как от
          лампы над столом) вместо плоской заливки, для объёма. Цвета те же
          фиксированные table/table-glow токены, не зависят от темы интерфейса. */}
      <div
        className="absolute left-1/2 top-1/2 h-[71%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-table-glow/40 shadow-[0_0_36px_-6px_rgba(25,169,116,0.45)]"
        style={{ background: 'radial-gradient(ellipse at 50% 42%, #1C7A4E 0%, #0F5B3A 62%, #0A3F28 100%)' }}
        aria-hidden="true"
      />

      {flights.map((f) => (
        <FlyingChip key={f.key} from={f.from} to={f.to} delayMs={f.delayMs} />
      ))}
      {winFlights.map((f, i) => (
        <FlyingChip key={f.key} from={{ left: 50, top: 50 }} to={f.to} big delayMs={i * 90} />
      ))}

      {/* Банк в центре */}
      <div className="absolute left-1/2 top-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 text-center">
        {handStage && street && (
          <div className="mb-1.5">
            <CommunityCardSlots handStage={handStage} street={street} />
          </div>
        )}
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ivory/60">{t.bankLabel}</p>
        <p
          key={potPulse}
          className={`font-mono text-2xl font-semibold tabular-nums text-brass-light ${pot > 0 ? 'animate-chip-pulse' : ''}`}
        >
          {formatChips(pot)}
        </p>
        {smallBlind != null && bigBlind != null && (
          <p className="mt-1 font-mono text-[10px] text-ivory/50">
            {formatChips(smallBlind)}/{formatChips(bigBlind)}
          </p>
        )}
      </div>

      {n === 0 && (
        <p className="absolute left-1/2 top-[78%] w-full -translate-x-1/2 text-center text-sm text-muted">
          {t.noPlayers}
        </p>
      )}

      {(() => {
        const maxStack = Math.max(1, ...sorted.map((p) => p.current_stack));
        return sorted.map((p, i) => {
          const { left, top } = seatPos(visualSeatIndex(i, n, meIndex), n);
          const isMe = p.id === highlightPlayerId;
          // Своя стопка крупнее, но на той же дистанции до места, что и у
          // остальных — если придвинуть ближе к месту, она уходит ПОД
          // карточку игрока (карточка всегда поверх по z-index) и большая
          // часть стопки оказывается не видна вообще, что хуже, а не лучше.
          const pile = { left: left + (50 - left) * PILE_T, top: top + (50 - top) * PILE_T };
          const pileChipSize = isMe ? 26 : 18;
          const pileLayers =
            p.current_stack <= 0 ? 0 : Math.max(1, Math.round((p.current_stack / maxStack) * MAX_PILE_LAYERS));
          const isDealer = p.id === dealerPlayerId;
        const isSB = p.id === sbId;
        const isBB = p.id === bbId;
        const isTurn = turnPlayerId != null && p.id === turnPlayerId;
        const isFolded = p.hand_state === 'folded';
        const isAllIn = p.hand_state === 'all_in';
        const isGlowing = glowingIds.has(p.id);
        const activeBubble = actionBubbles.find((b) => b.playerId === p.id);

        return (
          <Fragment key={p.id}>
            {!isFolded && pileLayers > 0 && (
              <div
                className="absolute z-[3] -translate-x-1/2 -translate-y-1/2 transition-opacity"
                style={{ left: `${pile.left}%`, top: `${pile.top}%` }}
                aria-hidden="true"
              >
                <ChipStackIcon size={pileChipSize} count={pileLayers} colorIndex={p.seat_index % 4} twoTone />
              </div>
            )}
            <div
              className="absolute z-[4] w-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
            {isTurn && !isGlowing && (
              <span
                className="absolute inset-0 -z-10 animate-ping rounded-xl bg-mint/25"
                style={{ animationDuration: '1.8s' }}
                aria-hidden="true"
              />
            )}
            {activeBubble && (
              <span
                key={activeBubble.key}
                className="absolute -top-3 left-1/2 z-[6] -translate-x-1/2 whitespace-nowrap rounded-full border border-hairline/15 bg-coal/90 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-paper shadow-sm"
              >
                {activeBubble.label}
              </span>
            )}
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
                    aria-label={t.dealerLabel}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-coal/20 bg-paper text-[10px] font-bold text-coal"
                  >
                    D
                  </span>
                )}
              </div>
              <p className={`max-w-full truncate text-center text-xs ${isMe ? 'font-semibold text-brass-light' : 'text-ivory'}`}>
                {p.name}
                {isMe ? ` (${t.actingYou})` : ''}
              </p>
              <p className="font-mono text-xs tabular-nums text-muted">{formatChips(p.current_stack)}</p>
              {isFolded ? (
                <span className="rounded-full bg-hairline/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-muted">
                  {t.actionFold}
                </span>
              ) : isAllIn ? (
                <span className="rounded-full bg-clay/15 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-clay-light">
                  {t.actionAllIn}
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
          </Fragment>
        );
        });
      })()}
    </div>
  );
});
