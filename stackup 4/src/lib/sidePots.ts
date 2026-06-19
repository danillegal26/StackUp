import type { Player } from '../types';

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

// Стандартный алгоритм сайд-потов: берём отдельные суммы all-in ставок
// (плюс просто самую большую ставку в руке) как «уровни отсечки», и для
// каждого уровня банк = (уровень - предыдущий уровень) × число игроков,
// доросших своей ставкой хотя бы до этого уровня (включая тех, кто потом
// сфолдил — их фишки остаются в банке, просто без права на выигрыш).
// Используется и на клиенте (показать хосту разбивку для выбора
// победителей), и независимо пересчитывается на сервере при начислении —
// клиентский расчёт нужен только для отображения, не для денег.
export function computeSidePots(players: Player[]): SidePot[] {
  const contributors = players.filter((p) => p.round_bet > 0);
  if (contributors.length === 0) return [];

  const levels = Array.from(new Set(contributors.map((p) => p.round_bet))).sort((a, b) => a - b);

  const pots: SidePot[] = [];
  let prevLevel = 0;
  for (const level of levels) {
    const layerSize = level - prevLevel;
    const funders = contributors.filter((p) => p.round_bet >= level);
    const amount = layerSize * funders.length;
    const eligiblePlayerIds = funders.filter((p) => p.hand_state !== 'folded').map((p) => p.id);
    if (amount > 0 && eligiblePlayerIds.length > 0) {
      pots.push({ amount, eligiblePlayerIds });
    }
    prevLevel = level;
  }
  return pots;
}
