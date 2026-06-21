import { useState } from 'react';
import { Modal } from './Modal';
import { Button, Banner } from './ui';
import { ChipAvatar } from './ChipAvatar';
import { getAvatarImage } from '../lib/avatars';
import { formatChips } from '../lib/utils';
import { computeSidePots } from '../lib/sidePots';
import type { Player } from '../types';

interface Props {
  players: Player[]; // активные игроки этой раздачи (фолднутые — тоже, для расчёта банков)
  onClose: () => void;
  onSubmit: (potWinners: string[][]) => Promise<void>;
}

function PlayerRow({ player, isSelected, onToggle }: { player: Player; isSelected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        isSelected ? 'border-brass bg-brass/10' : 'border-hairline/10 bg-hairline/[0.03]'
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
          isSelected ? 'border-brass bg-brass text-coal' : 'border-hairline/30 text-transparent'
        }`}
        aria-hidden="true"
      >
        ✓
      </span>
      <ChipAvatar name={player.name} index={player.seat_index} size={36} avatar={getAvatarImage(player.avatar_id)} />
      <span className="min-w-0 flex-1 truncate text-ivory">{player.name}</span>
      <span className="font-mono text-sm tabular-nums text-muted">{formatChips(player.current_stack)}</span>
    </button>
  );
}

export function WinnerSelectModal({ players, onClose, onSubmit }: Props) {
  const pots = computeSidePots(players);
  const [selections, setSelections] = useState<Set<string>[]>(() => pots.map(() => new Set<string>()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(potIdx: number, playerId: string) {
    setSelections((prev) => {
      const next = prev.map((s) => new Set(s));
      if (next[potIdx].has(playerId)) next[potIdx].delete(playerId);
      else next[potIdx].add(playerId);
      return next;
    });
  }

  const allPotsHaveWinner = selections.length > 0 && selections.every((s) => s.size > 0);

  async function handleSubmit() {
    if (!allPotsHaveWinner) {
      setError('Выберите хотя бы одного победителя для каждого банка');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(selections.map((s) => Array.from(s)));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось распределить банк');
      setSubmitting(false);
    }
  }

  if (pots.length === 0) {
    return (
      <Modal title="Выберите победителя" onClose={onClose}>
        <Banner kind="info">Сейчас распределять нечего.</Banner>
      </Modal>
    );
  }

  return (
    <Modal title="Выберите победителя" onClose={onClose}>
      <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
        {pots.map((pot, potIdx) => {
          const eligible = players.filter((p) => pot.eligiblePlayerIds.includes(p.id));
          const selected = selections[potIdx];
          return (
            <div key={potIdx}>
              <div className="mb-2 text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  {pots.length > 1 ? (potIdx === 0 ? 'Основной банк' : `Побочный банк ${potIdx}`) : 'Банк'}
                </p>
                <p className="font-mono text-2xl font-semibold tabular-nums text-brass-light">
                  {formatChips(pot.amount)}
                </p>
                {selected.size > 1 && (
                  <p className="mt-1 text-xs text-muted">Делится поровну между {selected.size} игроками</p>
                )}
              </div>
              <div className="space-y-2">
                {eligible.map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    isSelected={selected.has(p.id)}
                    onToggle={() => toggle(potIdx, p.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-4">
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      <Button className="mt-4 w-full" onClick={handleSubmit} disabled={submitting || !allPotsHaveWinner}>
        {submitting ? 'Распределяем…' : 'Подтвердить и завершить раздачу'}
      </Button>
    </Modal>
  );
}
