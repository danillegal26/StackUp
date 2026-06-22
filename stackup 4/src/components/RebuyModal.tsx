import { useState } from 'react';
import { Modal } from './Modal';
import { Button, Input, Banner } from './ui';
import { useT } from '../hooks/useLang';
import type { Player } from '../types';

interface Props {
  player: Player;
  defaultAmount: number;
  onClose: () => void;
  onSubmit: (amount: number, type: 'rebuy' | 'addon') => Promise<void>;
}

export function RebuyModal({ player, defaultAmount, onClose, onSubmit }: Props) {
  const t = useT();
  const [amount, setAmount] = useState(String(defaultAmount));
  const [type, setType] = useState<'rebuy' | 'addon'>('rebuy');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError(t.errRebuyZero);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(value, type);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errRebuy);
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Rebuy / Add-on: ${player.name}`} onClose={onClose}>
      <div className="mb-4 flex gap-2">
        <Button variant={type === 'rebuy' ? 'primary' : 'secondary'} className="flex-1" onClick={() => setType('rebuy')}>
          Rebuy
        </Button>
        <Button variant={type === 'addon' ? 'primary' : 'secondary'} className="flex-1" onClick={() => setType('addon')}>
          Add-on
        </Button>
      </div>

      <label className="mb-1 block text-xs text-muted">{t.rebuyAmount}</label>
      <Input
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mb-4"
      />

      {error && (
        <div className="mb-4">
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
        {submitting ? t.confirming : t.confirm}
      </Button>
    </Modal>
  );
}
