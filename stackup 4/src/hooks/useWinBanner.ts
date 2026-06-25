import { useEffect, useRef, useState } from 'react';
import type { Player, Room } from '../types';

export interface WinBannerData {
  names: string[];
  winnerIds: string[];
  amount: number;
  key: number;
}

// Показывает баннер «Х выиграл +N» ровно один раз за раздачу, на всех
// устройствах сразу (а не только у хоста, который нажал кнопку) — потому
// что last_hand_number/last_hand_winner_ids/last_hand_pot приходят через
// обычную realtime-подписку на rooms, как и всё остальное состояние.
export function useWinBanner(room: Room | null, players: Player[]): WinBannerData | null {
  const [banner, setBanner] = useState<WinBannerData | null>(null);
  const lastShown = useRef<number | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!room) return;

    // при первой загрузке страницы не показываем баннер за уже прошедшую
    // (возможно, давно) раздачу — только за те, что случаются после захода
    if (!initialized.current) {
      lastShown.current = room.last_hand_number;
      initialized.current = true;
      return;
    }

    if (room.last_hand_number != null && room.last_hand_number !== lastShown.current) {
      lastShown.current = room.last_hand_number;
      const ids = room.last_hand_winner_ids ?? [];
      const names = ids
        .map((id) => players.find((p) => p.id === id)?.name)
        .filter((n): n is string => Boolean(n));
      if (names.length > 0 && room.last_hand_pot) {
        setBanner({ names, winnerIds: ids, amount: room.last_hand_pot, key: room.last_hand_number });
        const timer = setTimeout(() => setBanner(null), 3400);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.last_hand_number]);

  return banner;
}
