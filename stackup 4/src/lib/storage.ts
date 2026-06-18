import type { PlayerSession } from '../types';

const HOST_PREFIX = 'stackup_host_';
const PLAYER_PREFIX = 'stackup_player_';

export function saveHostToken(roomId: string, hostToken: string): void {
  localStorage.setItem(HOST_PREFIX + roomId, hostToken);
}

export function getHostToken(roomId: string): string | null {
  return localStorage.getItem(HOST_PREFIX + roomId);
}

export function savePlayerSession(roomId: string, playerId: string, name: string): void {
  const session: PlayerSession = { playerId, name };
  localStorage.setItem(PLAYER_PREFIX + roomId, JSON.stringify(session));
}

export function getPlayerSession(roomId: string): PlayerSession | null {
  const raw = localStorage.getItem(PLAYER_PREFIX + roomId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}
