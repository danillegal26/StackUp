import { supabase } from './supabaseClient';
import type { Player, PlayerResult, Room, RoomWithHostToken, Transaction, TransactionType } from '../types';

export async function createRoom(
  name: string,
  startingStack: number,
  maxPlayers: number
): Promise<RoomWithHostToken> {
  const { data, error } = await supabase
    .rpc('create_room', {
      p_name: name,
      p_starting_stack: startingStack,
      p_max_players: maxPlayers,
    })
    .single();
  if (error) throw error;
  return data as RoomWithHostToken;
}

export async function getRoom(roomId: string): Promise<Room> {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  if (error) throw error;
  return data as Room;
}

export async function joinRoom(roomId: string, name: string): Promise<Player> {
  const { data, error } = await supabase
    .rpc('join_room', { p_room_id: roomId, p_name: name })
    .single();
  if (error) throw error;
  return data as Player;
}

export async function getPlayers(roomId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data as Player[];
}

export async function adjustStack(
  roomId: string,
  hostToken: string,
  playerId: string,
  amount: number
): Promise<Player> {
  const { data, error } = await supabase
    .rpc('adjust_stack', {
      p_room_id: roomId,
      p_host_token: hostToken,
      p_player_id: playerId,
      p_amount: amount,
    })
    .single();
  if (error) throw error;
  return data as Player;
}

export async function addRebuy(
  roomId: string,
  hostToken: string,
  playerId: string,
  amount: number,
  type: Extract<TransactionType, 'rebuy' | 'addon'> = 'rebuy'
): Promise<Player> {
  const { data, error } = await supabase
    .rpc('add_rebuy', {
      p_room_id: roomId,
      p_host_token: hostToken,
      p_player_id: playerId,
      p_amount: amount,
      p_type: type,
    })
    .single();
  if (error) throw error;
  return data as Player;
}

export async function finishGame(roomId: string, hostToken: string): Promise<Room> {
  const { data, error } = await supabase
    .rpc('finish_game', { p_room_id: roomId, p_host_token: hostToken })
    .single();
  if (error) throw error;
  return data as Room;
}

export async function removePlayer(roomId: string, hostToken: string, playerId: string): Promise<Player> {
  const { data, error } = await supabase
    .rpc('remove_player', { p_room_id: roomId, p_host_token: hostToken, p_player_id: playerId })
    .single();
  if (error) throw error;
  return data as Player;
}

export async function getTransactions(roomId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Transaction[];
}

export async function getResults(roomId: string): Promise<PlayerResult[]> {
  const { data, error } = await supabase.from('player_results').select('*').eq('room_id', roomId);
  if (error) throw error;
  return data as PlayerResult[];
}
