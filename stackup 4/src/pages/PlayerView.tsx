import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Banner, Spinner } from '../components/ui';
import { PlayerCard } from '../components/PlayerCard';
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
  const others = players.filter((p) => p.id !== session.playerId && p.status === 'active');

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-8">
      <header className="mb-6 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">{room.name || 'покерный стол'}</p>
        <h1 className="font-display text-xl text-ivory">{session.name}</h1>
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

      {me && (
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm text-muted">{me.status === 'left' ? 'Стек на момент ухода' : 'Ваш стек'}</p>
          <p className="font-mono text-6xl font-semibold tabular-nums text-brass-light">
            {formatChips(me.current_stack)}
          </p>
        </div>
      )}

      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="mb-2 font-display text-sm text-muted">За столом</h2>
          {others.map((p, i) => (
            <PlayerCard key={p.id} player={p} index={i} />
          ))}
        </section>
      )}
    </div>
  );
}
