import { useState } from 'react';
import { formatChips } from '../lib/utils';
import { useT } from '../hooks/useLang';
import type { Player, Transaction, TransactionType } from '../types';

function formatTime(iso: string, lang: string): string {
  return new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  transactions: Transaction[];
  players: Player[];
}

export function TransactionLog({ transactions, players }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  const TYPE_LABELS: Record<TransactionType, string> = {
    buyin: t.txBuyin,
    rebuy: 'Rebuy',
    addon: 'Add-on',
    adjustment: t.txAdjust,
  };

  return (
    <div className="rounded-2xl border border-hairline/10 bg-hairline/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[48px] w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ivory"
        aria-expanded={open}
      >
        {t.txHistory(transactions.length)}
        <span aria-hidden="true" className="text-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-hairline/10 px-4 py-3">
          {transactions.map((tx) => {
            const positive = tx.amount > 0;
            return (
              <div key={tx.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-ivory">{nameById.get(tx.player_id) ?? t.txPlayer}</p>
                  <p className="text-xs text-muted">
                    {TYPE_LABELS[tx.type]} · {formatTime(tx.created_at, t.lang)}
                  </p>
                </div>
                <p className={`shrink-0 font-mono tabular-nums ${positive ? 'text-brass-light' : 'text-clay-light'}`}>
                  {positive ? '+' : ''}{formatChips(tx.amount)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
