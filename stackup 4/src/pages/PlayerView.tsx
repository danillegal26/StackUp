import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Banner, Spinner } from '../components/ui';
import { PokerTable } from '../components/PokerTable';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { getPlayerSession } from '../lib/storage';
import { formatChips } from '../lib/utils';

export default function PlayerView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const session = roomId ? getPlayerSession(roomId) : null;
  const { room, players, loading, error } = useRoomRealtime(roomId);

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

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-8">
      <header className="mb-6 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">{room.name || 'покерный стол'}</p>
        <h1 className="flex items-center justify-center gap-2 font-display text-xl text-ivory">
          {session.name}
          {room.status !== 'finished' && (
            <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]" aria-hidden="true" />
          )}
        </h1>
      </header>

      {room.status === 'finished' && (
        <div className="mb-6">
          <Banner kind="info">Игра завершена. Переходим к итогам…</Banner>
        </div>
      )}

      {me?.status === 'left' && room.status !== 'finished' && (
        <div className="mb-6">
          <Banner kind="info">
            Организатор отметил, что вы покинули стол. Ваш итоговый результат зафиксирован — он появится, когда игра
            завершится.
          </Banner>
        </div>
      )}

      {room.status === 'lobby' && me?.status === 'active' && (
        <div className="mb-6">
          <Banner kind="info">Ожидаем, когда организатор начнёт игру…</Banner>
        </div>
      )}

      {room.status === 'active' && me?.status === 'active' && (
        <p className="mb-3 text-center text-xs text-muted">Раздача №{room.hand_number}</p>
      )}

      <section className="mb-6">
        <PokerTable
          players={activePlayers}
          dealerPlayerId={room.status === 'active' ? room.dealer_player_id : null}
          smallBlind={room.status === 'active' ? room.small_blind : null}
          bigBlind={room.status === 'active' ? room.big_blind : null}
          highlightPlayerId={session.playerId}
        />
      </section>

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
