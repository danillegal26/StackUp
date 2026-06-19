import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Banner, Spinner, Card, Input } from '../components/ui';
import { QRCodeBlock } from '../components/QRCodeBlock';
import { PlayerCard } from '../components/PlayerCard';
import { PokerTable } from '../components/PokerTable';
import { ActionBar } from '../components/ActionBar';
import { AvatarPicker } from '../components/AvatarPicker';
import { StackAdjustModal } from '../components/StackAdjustModal';
import { RebuyModal } from '../components/RebuyModal';
import { BlindsModal } from '../components/BlindsModal';
import { TransactionLog } from '../components/TransactionLog';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { getHostToken, getPlayerSession, savePlayerSession } from '../lib/storage';
import { randomAvatarId } from '../lib/avatars';
import {
  adjustStack,
  addRebuy,
  finishGame,
  removePlayer,
  hostJoinRoom,
  startGame,
  nextHand,
  setBlinds as setBlindsApi,
  playerAction,
  type PlayerActionType,
} from '../lib/roomApi';
import { formatChips } from '../lib/utils';
import type { Player } from '../types';

export default function HostDashboard() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const hostToken = roomId ? getHostToken(roomId) : null;
  const mySession = roomId ? getPlayerSession(roomId) : null;
  const { room, players, transactions, loading, error } = useRoomRealtime(roomId);

  const [adjustTarget, setAdjustTarget] = useState<Player | null>(null);
  const [rebuyTarget, setRebuyTarget] = useState<Player | null>(null);
  const [blindsOpen, setBlindsOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinAvatar, setJoinAvatar] = useState<string | null>(() => randomAvatarId());
  const [joining, setJoining] = useState(false);
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

  async function handleJoinAsPlayer(e: FormEvent) {
    e.preventDefault();
    if (!roomId || !hostToken) return;
    if (!joinName.trim()) {
      setActionError('Введите имя');
      return;
    }
    setJoining(true);
    setActionError(null);
    try {
      const { playerId, playerToken } = await hostJoinRoom(roomId, hostToken, joinName.trim(), joinAvatar);
      savePlayerSession(roomId, playerId, playerToken, joinName.trim());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось сесть за стол');
    } finally {
      setJoining(false);
    }
  }

  async function handleStart() {
    if (!roomId || !hostToken) return;
    setStarting(true);
    setActionError(null);
    try {
      await startGame(roomId, hostToken);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось начать игру');
    } finally {
      setStarting(false);
    }
  }

  async function handleNextHand() {
    if (!roomId || !hostToken) return;
    setActionError(null);
    try {
      await nextHand(roomId, hostToken);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось перейти к следующей раздаче');
    }
  }

  async function handleSetBlinds(small: number, big: number) {
    if (!roomId || !hostToken) return;
    await setBlindsApi(roomId, hostToken, small, big);
  }

  const activePlayers = players.filter((p) => p.status === 'active');
  const leftPlayers = players.filter((p) => p.status === 'left');
  const totalChips = activePlayers.reduce((sum, p) => sum + p.current_stack, 0);
  const me = mySession ? players.find((p) => p.id === mySession.playerId) : undefined;
  const meIsSeated = !!me && me.status === 'active';
  const potUnresolved = room.hand_stage !== 'idle' && room.pot > 0;

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-8">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">панель организатора</p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ivory">
          {room.name || 'Покерный стол'}
          {room.status !== 'finished' && (
            <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]" aria-hidden="true" />
          )}
        </h1>
        <p className="text-sm text-muted">
          Старт: {formatChips(room.starting_stack)} фишек · в столе: {formatChips(totalChips)}
          {room.small_blind != null && room.big_blind != null && (
            <>
              {' '}
              · блайнды {formatChips(room.small_blind)}/{formatChips(room.big_blind)}
            </>
          )}
        </p>
      </header>

      {actionError && (
        <div className="mb-4">
          <Banner kind="error">{actionError}</Banner>
        </div>
      )}

      {room.status === 'lobby' && (
        <>
          <section className="mb-6">
            <QRCodeBlock url={joinUrl} />
          </section>

          {!meIsSeated && (
            <section className="mb-6">
              <form onSubmit={handleJoinAsPlayer}>
                <Card className="space-y-3">
                  <p className="text-sm text-ivory">Хотите играть сами?</p>
                  <Input
                    placeholder="Ваше имя за столом"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                  />
                  <div>
                    <p className="mb-1 text-xs text-muted">Аватар</p>
                    <AvatarPicker value={joinAvatar} onChange={setJoinAvatar} />
                  </div>
                  <Button type="submit" variant="secondary" className="w-full" disabled={joining}>
                    {joining ? 'Садимся…' : 'Сесть за стол'}
                  </Button>
                </Card>
              </form>
            </section>
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
                highlight={mySession?.playerId === p.id}
                onAdjust={() => setAdjustTarget(p)}
                onRebuy={() => setRebuyTarget(p)}
                onRemove={() => handleRemove(p)}
              />
            ))}
          </section>

          <Button className="w-full" onClick={handleStart} disabled={starting || activePlayers.length < 2}>
            {starting ? 'Запускаем…' : 'Начать игру'}
          </Button>
          {activePlayers.length < 2 && (
            <p className="mt-2 text-center text-xs text-muted">Нужно минимум 2 игрока за столом</p>
          )}
        </>
      )}

      {room.status === 'active' && (
        <>
          <section className="mb-4">
            <p className="mb-3 text-center text-xs text-muted">Раздача №{room.hand_number}</p>

            {room.hand_stage === 'awaiting_winner' && room.pot > 0 && (
              <div className="mb-4">
                <Banner kind="info">
                  Раздача завершена, банк {formatChips(room.pot)}. Выберите победителя: добавьте ему банк через
                  кнопку «Стек» у нужного игрока, затем нажмите «Следующая раздача».
                </Banner>
              </div>
            )}

            <PokerTable
              players={activePlayers}
              dealerPlayerId={room.dealer_player_id}
              smallBlind={room.small_blind}
              bigBlind={room.big_blind}
              pot={room.pot}
              turnPlayerId={room.turn_player_id}
              highlightPlayerId={mySession?.playerId}
            />
          </section>

          {me && room.hand_stage === 'betting' && room.turn_player_id === me.id && me.hand_state === 'active' && (
            <div className="mb-6">
              <ActionBar
                room={room}
                me={me}
                onAction={async (action: PlayerActionType, amount?: number) =>
                  void (await playerAction(roomId, me.id, mySession!.playerToken, action, amount))
                }
              />
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setBlindsOpen(true)}>
              Блайнды
            </Button>
            <Button onClick={handleNextHand} disabled={potUnresolved}>
              Следующая раздача →
            </Button>
          </div>
          {potUnresolved && (
            <p className="-mt-4 mb-6 text-center text-xs text-muted">
              Сначала распределите банк {formatChips(room.pot)} вручную через «Стек»
            </p>
          )}

          <section className="mb-6 space-y-2">
            <h2 className="mb-2 font-display text-lg text-ivory">
              Игроки ({activePlayers.length}/{room.max_players})
            </h2>
            {activePlayers.map((p, i) => (
              <PlayerCard
                key={p.id}
                player={p}
                index={i}
                highlight={mySession?.playerId === p.id}
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
        </>
      )}

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
      {blindsOpen && (
        <BlindsModal
          currentSmall={room.small_blind}
          currentBig={room.big_blind}
          onClose={() => setBlindsOpen(false)}
          onSubmit={handleSetBlinds}
        />
      )}
    </div>
  );
}
