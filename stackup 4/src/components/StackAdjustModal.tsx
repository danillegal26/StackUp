import { useState } from 'react';
import { Modal } from './Modal';
import { Button, Input, Banner } from './ui';
import { formatChips } from '../lib/utils';
import { useT } from '../hooks/useLang';
import type { Player } from '../types';

interface Props {
  player: Player;
  onClose: () => void;
  onSubmit: (delta: number) => Promise<void>;
}

const QUICK_DELTAS = [-100, -25, 25, 100];

export function StackAdjustModal({ player, onClose, onSubmit }: Props) {
  const t = useT();
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(delta: number) {
    if (!delta) return;
    if (player.current_stack + delta < 0) {
      setError(t.errStackNegative);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(delta);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errStackAdjust);
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`${t.stackAdjustTitle}: ${player.name}`} onClose={onClose}>
      <p className="mb-4 font-mono text-2xl tabular-nums text-brass-light">{formatChips(player.current_stack)}</p>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {QUICK_DELTAS.map((d) => (
          <Button key={d} variant="secondary" disabled={submitting} onClick={() => apply(d)}>
            {d > 0 ? `+${d}` : d}
          </Button>
        ))}
      </div>

      <label className="mb-1 block text-xs text-muted">{t.stackNewValue}</label>
      <div className="mb-4 flex gap-2">
        <Input
          type="number"
          inputMode="numeric"
          placeholder={t.stackPlaceholder}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button variant="ghost" disabled={submitting || !amount} onClick={() => apply(Number(amount))}>
          +
        </Button>
        <Button variant="ghost" disabled={submitting || !amount} onClick={() => apply(-Number(amount))}>
          −
        </Button>
      </div>

      {error && <Banner kind="error">{error}</Banner>}
    </Modal>
  );
}
