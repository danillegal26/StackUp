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
import { WinnerSelectModal } from '../components/WinnerSelectModal';
import { NextToActBanner } from '../components/NextToActBanner';
import { WinBanner } from '../components/WinBanner';
import { TransactionLog } from '../components/TransactionLog';
import { useT } from '../hooks/useLang';
import { HandHistoryList } from '../components/HandHistoryList';
import { StageIndicator } from '../components/StageIndicator';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { useWinBanner } from '../hooks/useWinBanner';
import { useTurnTimer } from '../hooks/useTurnTimer';
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
  nextStage,
  setBlinds as setBlindsApi,
  setTurnTimer as setTurnTimerApi,
  playerAction,
  awardPots,
  type PlayerActionType,
} from '../lib/roomApi';
import { formatChips } from '../lib/utils';
import { translateError } from '../lib/errors';
import type { Player } from '../types';

export default function HostDashboard() {
  const t = useT();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const hostToken = roomId ? getHostToken(roomId) : null;
  const mySession = roomId ? getPlayerSession(roomId) : null;
  const { room, players, transactions, hands, loading, error } = useRoomRealtime(roomId, { withHistory: true });
  const winBanner = useWinBanner(room, players);
  const secondsLeft = useTurnTimer(roomId, room);

  const [adjustTarget, setAdjustTarget] = useState<Player | null>(null);
  const [rebuyTarget, setRebuyTarget] = useState<Player | null>(null);
  const [blindsOpen, setBlindsOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
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
          {t.hostPanel}
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
        <Banner kind="error">{error ?? t.errRoomNotFoundShort}</Banner>
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
    if (!confirm(`${player.name}?`)) {
      return;
    }
    setActionError(null);
    try {
      await removePlayer(roomId, hostToken, player.id);
    } catch (err) {
      setActionError(translateError(err, t.errKickPlayer));
    }
  }

  async function handleFinish() {
    if (!roomId || !hostToken || !room) return;
    const handInProgress = room.hand_stage !== 'idle' && room.pot > 0;
    const message = handInProgress
      ? t.finishGameHint(formatChips(room.pot))
      : t.finishConfirm;
    if (!confirm(message)) return;
    setFinishing(true);
    setActionError(null);
    try {
      await finishGame(roomId, hostToken);
      navigate(`/results/${roomId}`);
    } catch (err) {
      setActionError(translateError(err, t.errFinishGame));
      setFinishing(false);
    }
  }

  async function handleJoinAsPlayer(e: FormEvent) {
    e.preventDefault();
    if (!roomId || !hostToken) return;
    if (!joinName.trim()) {
      setActionError(t.errNameRequired);
      return;
    }
    setJoining(true);
    setActionError(null);
    try {
      const { playerId, playerToken } = await hostJoinRoom(roomId, hostToken, joinName.trim(), joinAvatar);
      savePlayerSession(roomId, playerId, playerToken, joinName.trim());
    } catch (err) {
      setActionError(translateError(err, t.errSitDown));
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
      setActionError(translateError(err, t.errStartGame));
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
      setActionError(translateError(err, t.errNextHand));
    }
  }

  async function handleNextStage() {
    if (!roomId || !hostToken) return;
    setActionError(null);
    try {
      await nextStage(roomId, hostToken);
    } catch (err) {
      setActionError(translateError(err, t.errNextStreet));
    }
  }

  async function handleSetBlinds(small: number, big: number) {
    if (!roomId || !hostToken) return;
    await setBlindsApi(roomId, hostToken, small, big);
  }

  async function handleSetTimer(seconds: number | null) {
    if (!roomId || !hostToken) return;
    await setTurnTimerApi(roomId, hostToken, seconds);
    setTimerOpen(false);
  }

  async function handleAwardPot(potWinners: string[][]) {
    if (!roomId || !hostToken) return;
    await awardPots(roomId, hostToken, potWinners);
  }

  const activePlayers = useMemo(
    () => players.filter((p) => p.status === 'active'),
    [players]
  );
  const leftPlayers = useMemo(
    () => players.filter((p) => p.status === 'left'),
    [players]
  );
  const totalChips = useMemo(
    () => activePlayers.reduce((sum, p) => sum + p.current_stack, 0),
    [activePlayers]
  );
  const winAnnouncement = useMemo(
    () => (winBanner ? { winnerIds: winBanner.winnerIds, key: winBanner.key } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [winBanner?.key]
  );
  const me = mySession ? players.find((p) => p.id === mySession.playerId) : undefined;
  const meIsSeated = !!me && me.status === 'active';
  const potUnresolved = room.hand_stage !== 'idle' && room.pot > 0;

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-8 md:max-w-2xl">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">{t.hostPanel}</p>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ivory">
            {room.name || 'StackUp'}
            {room.status !== 'finished' && (
              <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]" aria-hidden="true" />
            )}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span>
              {t.startStack}: {formatChips(room.starting_stack)} · {t.inTable(formatChips(totalChips))}
            </span>
            {room.small_blind != null && room.big_blind != null && (
              <button
                type="button"
                onClick={() => setBlindsOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-hairline/15 px-2 py-0.5 font-mono text-xs text-ivory transition hover:border-brass/40"
              >
                {t.blindsLabel} {formatChips(room.small_blind)}/{formatChips(room.big_blind)}
                <span aria-hidden="true" className="text-muted">
                  ✎
                </span>
              </button>
            )}
          </div>
          {room.status === 'active' && room.hand_stage !== 'idle' && (
            <div className="mt-2">
              <StageIndicator handStage={room.hand_stage} street={room.street} />
            </div>
          )}
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline/15 bg-felt-light/60 px-3 py-1.5 font-mono text-xs text-ivory">
          <span aria-hidden="true">👤</span>
          {activePlayers.length}/{room.max_players}
        </span>
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
                  <p className="text-sm text-ivory">{t.wantToPlay}</p>
                  <Input
                    {...{placeholder: t.yourNameTable}}
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                  />
                  <div>
                    <p className="mb-1 text-xs text-muted">{t.chooseAvatar}</p>
                    <AvatarPicker value={joinAvatar} onChange={setJoinAvatar} />
                  </div>
                  <Button type="submit" variant="secondary" className="w-full" disabled={joining}>
                    {joining ? t.joining : t.sitDown}
                  </Button>
                </Card>
              </form>
            </section>
          )}

          <section className="mb-6 space-y-2">
            <h2 className="mb-2 font-display text-lg text-ivory">
              {t.players} ({activePlayers.length}/{room.max_players})
            </h2>
            {activePlayers.length === 0 && (
              <p className="text-sm text-muted">{t.noPlayersYet}</p>
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
            {starting ? t.joining : t.startGame}
          </Button>
          {activePlayers.length < 2 && (
            <p className="mt-2 text-center text-xs text-muted">{t.needMinPlayers}</p>
          )}
        </>
      )}

      {room.status === 'active' && (
        <>
          <section className="mb-4">
            <p className="mb-2 text-center text-xs text-muted">{t.handN(room.hand_number)}</p>

            {room.hand_stage === 'awaiting_winner' && room.pot > 0 && (
              <div className="mb-4 space-y-3">
                <Banner kind="info">{t.showdown}</Banner>
                <Button className="w-full" onClick={() => setWinnerModalOpen(true)}>
                  {t.awardPot}
                </Button>
              </div>
            )}

            {room.hand_stage === 'betting' && room.turn_player_id === null && (
              <div className="mb-4 space-y-3">
                <Banner kind="info">
                  {t.roundOver}
                </Banner>
                <Button className="w-full" onClick={handleNextStage}>
                  {t.nextStreet}
                </Button>
              </div>
            )}

            {room.hand_stage === 'betting' && room.turn_player_id && (
              <NextToActBanner
                name={players.find((p) => p.id === room.turn_player_id)?.name ?? ''}
                isMe={room.turn_player_id === mySession?.playerId}
                secondsLeft={secondsLeft}
              />
            )}

            <div className="relative mt-10">
              {winBanner && <WinBanner data={winBanner} />}
              <PokerTable
                players={activePlayers}
                dealerPlayerId={room.dealer_player_id}
                smallBlind={room.small_blind}
                bigBlind={room.big_blind}
                pot={room.pot}
                turnPlayerId={room.turn_player_id}
                highlightPlayerId={mySession?.playerId}
                winAnnouncement={winAnnouncement}
                handStage={room.hand_stage}
                street={room.street}
              />
            </div>
          </section>

          {me && room.hand_stage === 'betting' && room.turn_player_id === me.id && me.hand_state === 'active' && (
            <div className="mb-6">
              <ActionBar
                room={room}
                me={me}
                secondsLeft={secondsLeft}
                onAction={(action: PlayerActionType, amount?: number) => {
                  if (!roomId || !me || !mySession) return Promise.resolve();
                  return playerAction(roomId, me.id, mySession.playerToken, action, amount);
                }}
              />
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setBlindsOpen(true)}>
              {t.blindsBtn}
            </Button>
            <Button variant="secondary" onClick={() => setTimerOpen(true)}>
              {t.timerBtn(room.turn_timer_seconds)}
            </Button>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <Button onClick={handleNextHand} disabled={potUnresolved} className="col-span-2">
              {t.nextHand}
            </Button>
          </div>
          {potUnresolved && (
            <p className="-mt-4 mb-6 text-center text-xs text-muted">
              {t.resolveFirst(formatChips(room.pot))}
            </p>
          )}

          <section className="mb-6 space-y-2">
            <h2 className="mb-2 font-display text-lg text-ivory">
              {t.players} ({activePlayers.length}/{room.max_players})
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
              <h2 className="mb-2 font-display text-sm text-muted">{t.players} ({leftPlayers.length})</h2>
              {leftPlayers.map((p, i) => (
                <PlayerCard key={p.id} player={p} index={activePlayers.length + i} />
              ))}
            </section>
          )}

          <section className="mb-8 space-y-3">
            <HandHistoryList hands={hands} players={players} />
            <TransactionLog transactions={transactions} players={players} />
          </section>

          <Button
            variant="danger"
            className="w-full"
            onClick={handleFinish}
            disabled={finishing || players.length === 0}
          >
            {finishing ? t.confirming : t.finishGame}
          </Button>
          {potUnresolved && (
            <p className="mt-2 text-center text-xs text-muted">
              {t.finishGameHint(formatChips(room.pot))}
            </p>
          )}
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
      {timerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-t-3xl bg-felt-light p-6 sm:rounded-3xl">
            <h2 className="mb-1 font-display text-lg font-semibold text-ivory">{t.timerModalTitle}</h2>
            <p className="mb-5 text-sm text-muted">{t.timerModalHint}</p>
            <div className="grid grid-cols-2 gap-2">
              {[15, 20, 25, 30, 45, 60, 90, 120].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSetTimer(s)}
                  className={`rounded-xl border py-3 text-sm font-medium transition active:scale-95 ${
                    room.turn_timer_seconds === s
                      ? 'border-brass bg-brass/10 text-brass-light'
                      : 'border-hairline/15 text-ivory hover:border-hairline/40'
                  }`}
                >
                  {s} {t.lang === 'en' ? 's' : 'с'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleSetTimer(null)}
                className={`col-span-2 rounded-xl border py-3 text-sm font-medium transition active:scale-95 ${
                  room.turn_timer_seconds == null
                    ? 'border-clay bg-clay/10 text-clay-light'
                    : 'border-hairline/15 text-ivory hover:border-hairline/40'
                }`}
              >
                {t.timerDisable}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setTimerOpen(false)}
              className="mt-4 w-full rounded-xl py-2.5 text-sm text-muted hover:text-ivory transition"
            >
              {t.timerClose}
            </button>
          </div>
        </div>
      )}
      {winnerModalOpen && (
        <WinnerSelectModal players={activePlayers} onClose={() => setWinnerModalOpen(false)} onSubmit={handleAwardPot} />
      )}
    </div>
  );
}
