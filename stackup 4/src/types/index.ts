export type RoomStatus = 'lobby' | 'active' | 'finished';

export interface Room {
  id: string;
  name: string | null;
  starting_stack: number;
  max_players: number;
  status: RoomStatus;
  currency: string | null;
  buy_in_amount: number | null;
  small_blind: number | null;
  big_blind: number | null;
  dealer_player_id: string | null;
  hand_number: number;
  created_at: string;
  finished_at: string | null;
}

export interface CreatedRoom {
  id: string;
  host_token: string;
}

export type PlayerStatus = 'active' | 'left';

export interface Player {
  id: string;
  room_id: string;
  name: string;
  current_stack: number;
  status: PlayerStatus;
  seat_index: number;
  is_host: boolean;
  joined_at: string;
}

export type TransactionType = 'buyin' | 'rebuy' | 'addon' | 'adjustment';

export interface Transaction {
  id: string;
  room_id: string;
  player_id: string;
  type: TransactionType;
  amount: number;
  created_at: string;
}

export interface PlayerResult {
  player_id: string;
  room_id: string;
  name: string;
  current_stack: number;
  total_buyin: number;
  result: number;
}

export interface PlayerSession {
  playerId: string;
  name: string;
}
