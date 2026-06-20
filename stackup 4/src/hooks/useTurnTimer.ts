import { useEffect, useState } from 'react';
import { checkTimeout } from '../lib/roomApi';
import type { Room } from '../types';

// Показывает секунды до конца хода для отображения, И параллельно сам
// раз в пару секунд тихо опрашивает check_timeout — это делает КАЖДЫЙ
// открытый экран (организатора и всех игроков), не только активного
// игрока, специально: если у того, чей сейчас ход, телефон разрядился
// или вкладка закрылась, кто-то другой всё равно вызовет авто-фолд/чек.
// На сервере вызов идемпотентен (атомарный «захват» через UPDATE...
// RETURNING), так что параллельные вызовы с разных устройств безопасны.
export function useTurnTimer(roomId: string | undefined, room: Room | null): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!roomId || !room || room.hand_stage !== 'betting' || !room.turn_deadline) {
      setSecondsLeft(null);
      return;
    }

    const deadline = new Date(room.turn_deadline).getTime();

    function tick() {
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }
    tick();
    const displayTimer = setInterval(tick, 1000);

    const pollTimer = setInterval(() => {
      checkTimeout(roomId).catch(() => {
        // тихо игнорируем — кто-то другой из открытых экранов справится,
        // или сработает при следующем опросе
      });
    }, 2500);

    return () => {
      clearInterval(displayTimer);
      clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, room?.hand_stage, room?.turn_deadline]);

  return secondsLeft;
}
