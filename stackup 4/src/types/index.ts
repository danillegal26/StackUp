export type RoomStatus = 'lobby' | 'active' | 'finished';
export type HandStage = 'idle' | 'betting' | 'awaiting_winner';

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
  pot: number;
  current_bet: number;
  turn_player_id: string | null;
  turn_deadline: string | null;
  last_aggressor_id: string | null;
  hand_stage: HandStage;
  last_hand_winner_ids: string[] | null;
  last_hand_pot: number | null;
  last_hand_number: number | null;
  created_at: string;
  finished_at: string | null;
}

export interface CreatedRoom {
  id: string;
  host_token: string;
}

export type PlayerStatus = 'active' | 'left';
export type HandState = 'active' | 'folded' | 'all_in';

export interface Player {
  id: string;
  room_id: string;
  name: string;
  current_stack: number;
  status: PlayerStatus;
  seat_index: number;
  is_host: boolean;
  avatar_id: string | null;
  round_bet: number;
  hand_state: HandState;
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
  playerToken: string;
  name: string;
}

export interface HandHistoryEntry {
  id: string;
  room_id: string;
  hand_number: number;
  pot: number;
  winner_ids: string[];
  created_at: string;
}
