import { useState } from 'react';
import { Modal } from './Modal';
import { Button, Input, Banner } from './ui';
import { useT } from '../hooks/useLang';

interface Props {
  currentSmall: number | null;
  currentBig: number | null;
  onClose: () => void;
  onSubmit: (small: number, big: number) => Promise<void>;
}

export function BlindsModal({
  currentSmall, currentBig, onClose, onSubmit }: Props) {
  const t = useT();
  const [small, setSmall] = useState(String(currentSmall ?? 10));
  const [big, setBig] = useState(String(currentBig ?? 20));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const sb = Number(small);
    const bb = Number(big);
    if (!sb || sb <= 0 || !bb || bb <= sb) {
      setError(t.errBlindsModal);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(sb, bb);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errSetBlinds);
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t.blindsModalTitle} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted">{t.smallBlind}</label>
          <Input type="number" inputMode="numeric" value={small} onChange={(e) => setSmall(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">{t.bigBlind}</label>
          <Input type="number" inputMode="numeric" value={big} onChange={(e) => setBig(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
        {submitting ? t.saving : t.save}
      </Button>
    </Modal>
  );
}
