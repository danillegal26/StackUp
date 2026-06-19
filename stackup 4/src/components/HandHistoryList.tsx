import { useState } from 'react';
import { formatChips } from '../lib/utils';
import type { HandHistoryEntry, Player } from '../types';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  hands: HandHistoryEntry[];
  players: Player[];
}

export function HandHistoryList({ hands, players }: Props) {
  const [open, setOpen] = useState(false);
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  return (
    <div className="rounded-2xl border border-hairline/10 bg-hairline/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[48px] w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ivory"
        aria-expanded={open}
      >
        История раздач ({hands.length})
        <span aria-hidden="true" className="text-muted">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-hairline/10 px-4 py-3">
          {hands.length === 0 && <p className="text-sm text-muted">Раздач пока не было.</p>}
          {hands.map((h) => {
            const names = h.winner_ids.map((id) => nameById.get(id) ?? 'Игрок').join(', ');
            return (
              <div key={h.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-ivory">
                    №{h.hand_number} · {names}
                  </p>
                  <p className="text-xs text-muted">{formatTime(h.created_at)}</p>
                </div>
                <p className="shrink-0 font-mono tabular-nums text-brass-light">+{formatChips(h.pot)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
