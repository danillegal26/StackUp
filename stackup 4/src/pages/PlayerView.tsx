import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Banner, Spinner } from '../components/ui';
import { PokerTable } from '../components/PokerTable';
import { ActionBar } from '../components/ActionBar';
import { NextToActBanner } from '../components/NextToActBanner';
import { WinBanner } from '../components/WinBanner';
import { StageIndicator } from '../components/StageIndicator';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { useWinBanner } from '../hooks/useWinBanner';
import { useTurnTimer } from '../hooks/useTurnTimer';
import { getPlayerSession } from '../lib/storage';
import { formatChips } from '../lib/utils';
import { translateError } from '../lib/errors';
import { playerAction, leaveTable, type PlayerActionType } from '../lib/roomApi';

export default function PlayerView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const session = roomId ? getPlayerSession(roomId) : null;
  const { room, players, loading, error } = useRoomRealtime(roomId);
  const winBanner = useWinBanner(room, players);
  const secondsLeft = useTurnTimer(roomId, room);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  useEffect(() => {
    if (roomId && !session) {
      navigate(`/join/${roomId}`, { replace: true });
    }
  }, [roomId, session, navigate]);

  useEffect(() => {
    if (room?.status === 'finished' && roomId) {
      const timer = setTimeout(() => navigate(`/results/${roomId}`, { replace: true }), 1200);
      return () => clearTimeout(timer);
    }
  }, [room?.status, roomId, navigate]);

  if (!roomId || !session) return null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Banner kind="error">{error ?? 'Стол не найден'}</Banner>
      </div>
    );
  }

  const me = players.find((p) => p.id === session.playerId);
  const activePlayers = players.filter((p) => p.status === 'active');

  async function handleLeave() {
    if (!roomId || !session) return;
    if (!confirm('Покинуть стол? Текущий стек зафиксируется как ваш итоговый результат.')) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      await leaveTable(roomId, session.playerId, session.playerToken);
    } catch (err) {
      setLeaveError(translateError(err, 'Не удалось покинуть стол'));
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-8">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="text-center flex-1">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">{room.name || 'покерный стол'}</p>
            <h1 className="flex items-center justify-center gap-2 font-display text-xl text-ivory">
              {session.name}
              {room.status !== 'finished' && (
                <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]" aria-hidden="true" />
              )}
            </h1>
            {room.status === 'active' && room.small_blind != null && room.big_blind != null && (
              <p className="mt-0.5 font-mono text-[11px] text-muted">
                блайнды {formatChips(room.small_blind)}/{formatChips(room.big_blind)}
              </p>
            )}
          </div>
          {me?.status === 'active' && room.status !== 'finished' && (
            <button
              type="button"
              onClick={handleLeave}
              disabled={leaving}
              className="shrink-0 rounded-lg border border-hairline/15 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted transition hover:border-clay/40 hover:text-clay-light disabled:opacity-40"
            >
              Покинуть стол
            </button>
          )}
        </div>
      </header>

      {leaveError && (
        <div className="mb-6">
          <Banner kind="error">{leaveError}</Banner>
        </div>
      )}

      {room.status === 'finished' && (
        <div className="mb-6">
          <Banner kind="info">Игра завершена. Переходим к итогам…</Banner>
        </div>
      )}

      {me?.status === 'left' && room.status !== 'finished' && (
        <div className="mb-6">
          <Banner kind="info">
            Вы вышли из-за стола (или организатор это сделал за вас). Ваш итоговый результат зафиксирован — он
            появится, когда игра завершится.
          </Banner>
        </div>
      )}

      {room.status === 'lobby' && me?.status === 'active' && (
        <div className="mb-6">
          <Banner kind="info">Ожидаем, когда организатор начнёт игру…</Banner>
        </div>
      )}

      {room.status === 'active' && me?.status === 'active' && (
        <div className="mb-3 space-y-2">
          <p className="text-center text-xs text-muted">Раздача №{room.hand_number}</p>
          {room.hand_stage !== 'idle' && <StageIndicator handStage={room.hand_stage} street={room.street} />}
        </div>
      )}

      {room.status === 'active' && room.hand_stage === 'awaiting_winner' && room.pot > 0 && (
        <div className="mb-6">
          <Banner kind="info">
            Вскрытие, банк {formatChips(room.pot)} — организатор сейчас выберет победителя.
          </Banner>
        </div>
      )}

      {room.status === 'active' && room.hand_stage === 'betting' && room.turn_player_id === null && (
        <div className="mb-6">
          <Banner kind="info">Круг торгов завершён — организатор сдаёт следующую карту(ы).</Banner>
        </div>
      )}

      {room.status === 'active' && room.hand_stage === 'betting' && room.turn_player_id && (
        <NextToActBanner
          name={players.find((p) => p.id === room.turn_player_id)?.name ?? ''}
          isMe={room.turn_player_id === session.playerId}
          secondsLeft={secondsLeft}
        />
      )}

      <section className="relative mb-6">
        {winBanner && <WinBanner data={winBanner} />}
        <PokerTable
          players={activePlayers}
          dealerPlayerId={room.status === 'active' ? room.dealer_player_id : null}
          smallBlind={room.status === 'active' ? room.small_blind : null}
          bigBlind={room.status === 'active' ? room.big_blind : null}
          pot={room.status === 'active' ? room.pot : 0}
          turnPlayerId={room.status === 'active' ? room.turn_player_id : null}
          highlightPlayerId={session.playerId}
          winAnnouncement={winBanner ? { winnerIds: winBanner.winnerIds, key: winBanner.key } : null}
          handStage={room.status === 'active' ? room.hand_stage : 'idle'}
          street={room.status === 'active' ? room.street : 'preflop'}
        />
      </section>

      {me &&
        room.status === 'active' &&
        room.hand_stage === 'betting' &&
        room.turn_player_id === me.id &&
        me.hand_state === 'active' && (
          <div className="mb-6">
            <ActionBar
              room={room}
              me={me}
              secondsLeft={secondsLeft}
              onAction={async (action: PlayerActionType, amount?: number) => {
                if (!roomId || !me || !session) return;
                await playerAction(roomId, me.id, session.playerToken, action, amount);
              }}
            />
          </div>
        )}

      {me && (
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm text-muted">{me.status === 'left' ? 'Стек на момент ухода' : 'Ваш стек'}</p>
          <p className="font-mono text-6xl font-semibold tabular-nums text-brass-light">
            {formatChips(me.current_stack)}
          </p>
        </div>
      )}
    </div>
  );
}
