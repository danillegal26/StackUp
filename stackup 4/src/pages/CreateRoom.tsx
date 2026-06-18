import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Banner } from '../components/ui';
import { createRoom } from '../lib/roomApi';
import { saveHostToken } from '../lib/storage';

export default function CreateRoom() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [startingStack, setStartingStack] = useState('1000');
  const [maxPlayers, setMaxPlayers] = useState('8');
  const [smallBlind, setSmallBlind] = useState('10');
  const [bigBlind, setBigBlind] = useState('20');
  const [buyInAmount, setBuyInAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const stack = Number(startingStack);
    const players = Number(maxPlayers);
    const sb = Number(smallBlind);
    const bb = Number(bigBlind);

    if (!stack || stack <= 0) {
      setError('Стартовый стек должен быть больше нуля');
      return;
    }
    if (!players || players < 2 || players > 50) {
      setError('Количество игроков — от 2 до 50');
      return;
    }
    if (!sb || sb <= 0 || !bb || bb <= sb) {
      setError('Большой блайнд должен быть больше малого, оба — больше нуля');
      return;
    }

    setSubmitting(true);
    try {
      const { room, hostToken } = await createRoom(
        name,
        stack,
        players,
        sb,
        bb,
        buyInAmount ? Number(buyInAmount) : null,
        currency.trim() || null
      );
      saveHostToken(room.id, hostToken);
      navigate(`/host/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать стол');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="mb-6 font-display text-3xl font-semibold text-ivory">Новый стол</h1>
        <Card className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted">Название игры (необязательно)</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Пятничный покер" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Стартовый стек</label>
            <Input
              type="number"
              inputMode="numeric"
              value={startingStack}
              onChange={(e) => setStartingStack(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Количество игроков</label>
            <Input
              type="number"
              inputMode="numeric"
              min={2}
              max={50}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Малый блайнд</label>
              <Input type="number" inputMode="numeric" value={smallBlind} onChange={(e) => setSmallBlind(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Большой блайнд</label>
              <Input type="number" inputMode="numeric" value={bigBlind} onChange={(e) => setBigBlind(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Бай-ин (необязательно)</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="500"
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Валюта</label>
              <Input placeholder="UAH" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} />
            </div>
          </div>
          {error && <Banner kind="error">{error}</Banner>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Создаём…' : 'Создать и получить QR-код'}
          </Button>
        </Card>
      </form>
    </div>
  );
}
