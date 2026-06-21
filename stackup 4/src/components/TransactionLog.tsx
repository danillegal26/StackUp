import { useState } from 'react';
import { formatChips } from '../lib/utils';
import type { Player, Transaction, TransactionType } from '../types';

const TYPE_LABELS: Record<TransactionType, string> = {
  buyin: 'Вход',
  rebuy: 'Rebuy',
  addon: 'Add-on',
  adjustment: 'Корректировка',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  transactions: Transaction[];
  players: Player[];
}

export function TransactionLog({ transactions, players }: Props) {
  const [open, setOpen] = useState(false);
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  return (
    <div className="rounded-2xl border border-hairline/10 bg-hairline/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[48px] w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ivory"
        aria-expanded={open}
      >
        История операций ({transactions.length})
        <span aria-hidden="true" className="text-muted">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-hairline/10 px-4 py-3">
          {transactions.length === 0 && <p className="text-sm text-muted">Операций пока нет.</p>}
          {transactions.map((t) => {
            const positive = t.amount > 0;
            return (
              <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-ivory">{nameById.get(t.player_id) ?? 'Игрок'}</p>
                  <p className="text-xs text-muted">
                    {TYPE_LABELS[t.type]} · {formatTime(t.created_at)}
                  </p>
                </div>
                <p className={`shrink-0 font-mono tabular-nums ${positive ? 'text-brass-light' : 'text-clay-light'}`}>
                  {positive ? '+' : ''}
                  {formatChips(t.amount)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
