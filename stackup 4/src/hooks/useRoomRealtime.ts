import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getHandHistory, getPlayers, getRoom, getTransactions } from '../lib/roomApi';
import type { HandHistoryEntry, Player, Room, Transaction } from '../types';

interface Options {
  /** Подгружать историю раздач и транзакции (только нужно хосту). Default: false */
  withHistory?: boolean;
}

interface RoomRealtimeState {
  room: Room | null;
  players: Player[];
  transactions: Transaction[];
  hands: HandHistoryEntry[];
  loading: boolean;
  error: string | null;
}

export function useRoomRealtime(
  roomId: string | undefined,
  { withHistory = false }: Options = {}
): RoomRealtimeState {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hands, setHands] = useState<HandHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handsCountRef = useRef(0);

  const refreshHistory = useCallback(async () => {
    if (!roomId || !withHistory) return;
    const [t, h] = await Promise.all([getTransactions(roomId), getHandHistory(roomId)]);
    setTransactions(t);
    setHands(h);
    handsCountRef.current = h.length;
  }, [roomId, withHistory]);

  const fullRefresh = useCallback(async () => {
    if (!roomId) return;
    try {
      // PlayerView: только room + players (2 запроса)
      // HostDashboard: room + players + transactions + hands (4 запроса)
      const baseRequests = [getRoom(roomId), getPlayers(roomId)] as const;
      const extraRequests = withHistory
        ? ([getTransactions(roomId), getHandHistory(roomId)] as const)
        : ([Promise.resolve([]), Promise.resolve([])] as const);

      const [r, p, t, h] = await Promise.all([...baseRequests, ...extraRequests]);
      setRoom(r as Room);
      setPlayers(p as Player[]);
      setTransactions(t as Transaction[]);
      setHands(h as HandHistoryEntry[]);
      handsCountRef.current = (h as HandHistoryEntry[]).length;
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить комнату');
    } finally {
      setLoading(false);
    }
  }, [roomId, withHistory]);

  useEffect(() => {
    if (!roomId) return;
    fullRefresh();

    const channel = supabase
      .channel(`room-${roomId}-${withHistory ? 'host' : 'player'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const newRoom = payload.new as Room;
            setRoom(newRoom);
            // Подгружаем историю только при завершении раздачи
            if (withHistory && (newRoom.hand_number ?? 0) > handsCountRef.current) {
              refreshHistory();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const newPlayer = payload.new as Player;
            setPlayers((prev) =>
              prev.some((p) => p.id === newPlayer.id) ? prev : [...prev, newPlayer]
            );
            if (withHistory) refreshHistory();
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new as Player;
            setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = (payload.old as { id: string }).id;
            setPlayers((prev) => prev.filter((p) => p.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [roomId, withHistory, fullRefresh, refreshHistory]);

  return { room, players, transactions, hands, loading, error };
}
