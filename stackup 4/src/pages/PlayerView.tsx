import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Banner, Spinner } from '../components/ui';
import { PokerTable } from '../components/PokerTable';
import { ChipStackIcon } from '../components/ChipStackIcon';
import { ActionBar } from '../components/ActionBar';
import { NextToActBanner } from '../components/NextToActBanner';
import { WinBanner } from '../components/WinBanner';
import { StageIndicator } from '../components/StageIndicator';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { useWinBanner } from '../hooks/useWinBanner';
import { useTurnTimer } from '../hooks/useTurnTimer';
import { useT } from '../hooks/useLang';
import { getPlayerSession } from '../lib/storage';
import { formatChips } from '../lib/utils';
import { translateError } from '../lib/errors';
import { playerAction, leaveTable, type PlayerActionType } from '../lib/roomApi';

export default function PlayerView() {
  const t = useT();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const session = roomId ? getPlayerSession(roomId) : null;
  const { room, players, loading, error } = useRoomRealtime(roomId);
  const winBanner = useWinBanner(room, players);
  const winAnnouncement = useMemo(
    () => (winBanner ? { winnerIds: winBanner.winnerIds, key: winBanner.key } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [winBanner?.key]
  );
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
        <Banner kind="error">{error ?? t.errRoomNotFoundPlayer}</Banner>
      </div>
    );
  }

  const me = players.find((p) => p.id === session.playerId);
  const activePlayers = players.filter((p) => p.status === 'active');

  async function handleLeave() {
    if (!roomId || !session) return;
    if (!confirm(t.leaveConfirm)) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      await leaveTable(roomId, session.playerId, session.playerToken);
    } catch (err) {
      setLeaveError(translateError(err, t.errLeave));
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-8 md:max-w-2xl">
      <header className="mb-6">        <div className="flex items-start justify-between gap-3">
          <div className="text-center flex-1">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">{room.name || 'StackUp'}</p>
            <h1 className="flex items-center justify-center gap-2 font-display text-xl text-ivory">
              {session.name}
              {room.status !== 'finished' && (
                <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]" aria-hidden="true" />
              )}
            </h1>
            {room.status === 'active' && room.small_blind != null && room.big_blind != null && (
              <p className="mt-0.5 font-mono text-[11px] text-muted">
                {t.blindsLabel} {formatChips(room.small_blind)}/{formatChips(room.big_blind)}
              </p>
            )}
            {room.status === 'active' && room.hand_stage !== 'idle' && (
              <div className="mt-2">
                <StageIndicator handStage={room.hand_stage} street={room.street} />
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {me?.status === 'active' && room.status !== 'finished' && (
              <button
                type="button"
                onClick={handleLeave}
                disabled={leaving}
                className="rounded-lg border border-hairline/15 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted transition hover:border-clay/40 hover:text-clay-light disabled:opacity-40"
              >
                {t.leaveTable}
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline/15 bg-felt-light/60 px-3 py-1.5 font-mono text-xs text-ivory">
              <span aria-hidden="true">👤</span>
              {activePlayers.length}/{room.max_players}
            </span>
          </div>
        </div>
      </header>

      {leaveError && (
        <div className="mb-6">
          <Banner kind="error">{leaveError}</Banner>
        </div>
      )}

      {room.status === 'finished' && (
        <div className="mb-6">
          <Banner kind="info">{t.gameFinished}</Banner>
        </div>
      )}

      {me?.status === 'left' && room.status !== 'finished' && (
        <div className="mb-6">
          <Banner kind="info">
            {t.leftTable}
          </Banner>
        </div>
      )}

      {room.status === 'lobby' && me?.status === 'active' && (
        <div className="mb-6">
          <Banner kind="info">{t.waitingForHost}</Banner>
        </div>
      )}

      {room.status === 'active' && me?.status === 'active' && me.current_stack === 0 &&
        room.hand_stage !== 'betting' && (
        <div className="mb-6">
          <Banner kind="info">
            {t.zeroStackBanner}
          </Banner>
        </div>
      )}

      {room.status === 'active' && me?.status === 'active' && (
        <div className="mb-3">
          <p className="text-center text-xs text-muted">{t.handN(room.hand_number)}</p>
        </div>
      )}

      {room.status === 'active' && room.hand_stage === 'awaiting_winner' && room.pot > 0 && (
        <div className="mb-6">
          <Banner kind="info">
            {t.awaitingWinner(formatChips(room.pot))}
          </Banner>
        </div>
      )}

      {room.status === 'active' && room.hand_stage === 'betting' && room.turn_player_id === null && (
        <div className="mb-6">
          <Banner kind="info">{t.roundOver}</Banner>
        </div>
      )}

      {room.status === 'active' && room.hand_stage === 'betting' && room.turn_player_id && (
        <NextToActBanner
          name={players.find((p) => p.id === room.turn_player_id)?.name ?? ''}
          isMe={room.turn_player_id === session.playerId}
          secondsLeft={secondsLeft}
        />
      )}

      <section className="relative mb-6 mt-10">
        {winBanner && <WinBanner data={winBanner} />}
        <PokerTable
          players={activePlayers}
          dealerPlayerId={room.status === 'active' ? room.dealer_player_id : null}
          smallBlind={room.status === 'active' ? room.small_blind : null}
          bigBlind={room.status === 'active' ? room.big_blind : null}
          pot={room.status === 'active' ? room.pot : 0}
          turnPlayerId={room.status === 'active' ? room.turn_player_id : null}
          highlightPlayerId={session.playerId}
          winAnnouncement={winAnnouncement}
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
              onAction={(action: PlayerActionType, amount?: number) => {
                if (!roomId || !me || !session) return Promise.resolve();
                return playerAction(roomId, me.id, session.playerToken, action, amount).then(() => {});
              }}
            />
          </div>
        )}

      {me && (
        <div className="mb-8 flex flex-col items-center gap-3">
          <p className="text-sm text-muted">{me.status === 'left' ? t.yourStack : t.yourStack}</p>
          <div className="flex items-center gap-5">
            <ChipStackIcon
              size={56}
              count={Math.max(1, Math.min(6, Math.round((me.current_stack / Math.max(1, room.starting_stack)) * 4)))}
            />
            <p className="font-mono text-6xl font-semibold tabular-nums text-brass-light">
              {formatChips(me.current_stack)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
