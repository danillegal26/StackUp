import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Banner, Spinner } from '../components/ui';
import { QRCodeBlock } from '../components/QRCodeBlock';
import { PlayerCard } from '../components/PlayerCard';
import { StackAdjustModal } from '../components/StackAdjustModal';
import { RebuyModal } from '../components/RebuyModal';
import { TransactionLog } from '../components/TransactionLog';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { getHostToken } from '../lib/storage';
import { adjustStack, addRebuy, finishGame, removePlayer } from '../lib/roomApi';
import { formatChips } from '../lib/utils';
import type { Player } from '../types';

export default function HostDashboard() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const hostToken = roomId ? getHostToken(roomId) : null;
  const { room, players, transactions, loading, error } = useRoomRealtime(roomId);

  const [adjustTarget, setAdjustTarget] = useState<Player | null>(null);
  const [rebuyTarget, setRebuyTarget] = useState<Player | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const joinUrl = useMemo(() => (roomId ? `${window.location.origin}/join/${roomId}` : ''), [roomId]);

  useEffect(() => {
    if (room?.status === 'finished' && roomId) {
      navigate(`/results/${roomId}`, { replace: true });
    }
  }, [room?.status, roomId, navigate]);

  if (!roomId) return null;

  if (!hostToken) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Banner kind="error">
          Этот браузер не распознан как организатор стола. Панель организатора доступна только на устройстве, на
          котором стол был создан.
        </Banner>
      </div>
    );
  }

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

  async function handleAdjust(delta: number) {
    if (!adjustTarget || !roomId || !hostToken) return;
    await adjustStack(roomId, hostToken, adjustTarget.id, delta);
  }

  async function handleRebuy(amount: number, type: 'rebuy' | 'addon') {
    if (!rebuyTarget || !roomId || !hostToken) return;
    await addRebuy(roomId, hostToken, rebuyTarget.id, amount, type);
  }

  async function handleRemove(player: Player) {
    if (!roomId || !hostToken) return;
    if (!confirm(`Убрать ${player.name} со стола? Итоговый результат игрока зафиксируется по текущему стеку.`)) {
      return;
    }
    setActionError(null);
    try {
      await removePlayer(roomId, hostToken, player.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось убрать игрока');
    }
  }

  async function handleFinish() {
    if (!roomId || !hostToken) return;
    if (!confirm('Завершить игру? Игроки увидят итоговый результат, изменения станут недоступны.')) return;
    setFinishing(true);
    setActionError(null);
    try {
      await finishGame(roomId, hostToken);
      navigate(`/results/${roomId}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось завершить игру');
      setFinishing(false);
    }
  }

  const activePlayers = players.filter((p) => p.status === 'active');
  const leftPlayers = players.filter((p) => p.status === 'left');
  const totalChips = activePlayers.reduce((sum, p) => sum + p.current_stack, 0);

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-8">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">панель организатора</p>
        <h1 className="font-display text-2xl font-semibold text-ivory">{room.name || 'Покерный стол'}</h1>
        <p className="text-sm text-muted">
          Старт: {formatChips(room.starting_stack)} фишек · в столе: {formatChips(totalChips)}
        </p>
      </header>

      <section className="mb-6">
        <QRCodeBlock url={joinUrl} />
      </section>

      {actionError && (
        <div className="mb-4">
          <Banner kind="error">{actionError}</Banner>
        </div>
      )}

      <section className="mb-6 space-y-2">
        <h2 className="mb-2 font-display text-lg text-ivory">
          Игроки ({activePlayers.length}/{room.max_players})
        </h2>
        {activePlayers.length === 0 && (
          <p className="text-sm text-muted">Пока никто не подключился. Покажите QR-код игрокам.</p>
        )}
        {activePlayers.map((p, i) => (
          <PlayerCard
            key={p.id}
            player={p}
            index={i}
            onAdjust={() => setAdjustTarget(p)}
            onRebuy={() => setRebuyTarget(p)}
            onRemove={() => handleRemove(p)}
          />
        ))}
      </section>

      {leftPlayers.length > 0 && (
        <section className="mb-6 space-y-2">
          <h2 className="mb-2 font-display text-sm text-muted">Ушли со стола ({leftPlayers.length})</h2>
          {leftPlayers.map((p, i) => (
            <PlayerCard key={p.id} player={p} index={activePlayers.length + i} />
          ))}
        </section>
      )}

      <section className="mb-8">
        <TransactionLog transactions={transactions} players={players} />
      </section>

      <Button
        variant="danger"
        className="w-full"
        onClick={handleFinish}
        disabled={finishing || players.length === 0}
      >
        {finishing ? 'Завершаем…' : 'Завершить игру'}
      </Button>

      {adjustTarget && (
        <StackAdjustModal player={adjustTarget} onClose={() => setAdjustTarget(null)} onSubmit={handleAdjust} />
      )}
      {rebuyTarget && (
        <RebuyModal
          player={rebuyTarget}
          defaultAmount={room.starting_stack}
          onClose={() => setRebuyTarget(null)}
          onSubmit={handleRebuy}
        />
      )}
    </div>
  );
}
