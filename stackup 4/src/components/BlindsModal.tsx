import { useState } from 'react';
import { Modal } from './Modal';
import { Button, Input, Banner } from './ui';

interface Props {
  currentSmall: number | null;
  currentBig: number | null;
  onClose: () => void;
  onSubmit: (small: number, big: number) => Promise<void>;
}

export function BlindsModal({ currentSmall, currentBig, onClose, onSubmit }: Props) {
  const [small, setSmall] = useState(String(currentSmall ?? 10));
  const [big, setBig] = useState(String(currentBig ?? 20));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const sb = Number(small);
    const bb = Number(big);
    if (!sb || sb <= 0 || !bb || bb <= sb) {
      setError('Большой блайнд должен быть больше малого, оба — больше нуля');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(sb, bb);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить блайнды');
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Блайнды" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted">Малый блайнд</label>
          <Input type="number" inputMode="numeric" value={small} onChange={(e) => setSmall(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Большой блайнд</label>
          <Input type="number" inputMode="numeric" value={big} onChange={(e) => setBig(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
        {submitting ? 'Сохраняем…' : 'Сохранить'}
      </Button>
    </Modal>
  );
}
