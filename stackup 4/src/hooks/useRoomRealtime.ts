import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getHandHistory, getPlayers, getRoom, getTransactions } from '../lib/roomApi';
import type { HandHistoryEntry, Player, Room, Transaction } from '../types';

interface RoomRealtimeState {
  room: Room | null;
  players: Player[];
  transactions: Transaction[];
  hands: HandHistoryEntry[];
  loading: boolean;
  error: string | null;
}

export function useRoomRealtime(roomId: string | undefined): RoomRealtimeState {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hands, setHands] = useState<HandHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const [r, p, t, h] = await Promise.all([
        getRoom(roomId),
        getPlayers(roomId),
        getTransactions(roomId),
        getHandHistory(roomId),
      ]);
      setRoom(r);
      setPlayers(p);
      setTransactions(t);
      setHands(h);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить комнату');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    refresh();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        refresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, refresh]);

  return { room, players, transactions, hands, loading, error };
}
