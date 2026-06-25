import type { PlayerResult } from '../types';

export interface Transfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

// Классический жадный алгоритм минимизации переводов: должник с самым
// большим долгом платит получателю с самым большим профитом, пока оба не
// закроются, и так по кругу. Не математически доказанный минимум для
// любых комбинаций (это NP-трудная задача), но даёт то же небольшое
// число переводов, что и популярные сервисы вроде Splitwise — для
// домашней игры на 6-10 человек этого более чем достаточно.
export function computeSettlement(results: PlayerResult[]): Transfer[] {
  const debtors = results
    .filter((r) => r.result < 0)
    .map((r) => ({ id: r.player_id, name: r.name, amount: -r.result }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = results
    .filter((r) => r.result > 0)
    .map((r) => ({ id: r.player_id, name: r.name, amount: r.result }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const pay = Math.min(debtor.amount, creditor.amount);

    if (pay > 0) {
      transfers.push({ fromId: debtor.id, fromName: debtor.name, toId: creditor.id, toName: creditor.name, amount: pay });
    }

    debtor.amount -= pay;
    creditor.amount -= pay;

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return transfers;
}
