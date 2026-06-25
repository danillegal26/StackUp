import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Banner } from '../components/ui';
import { createRoom, setTurnTimer as apiSetTurnTimer } from '../lib/roomApi';
import { translateError } from '../lib/errors';
import { saveHostToken } from '../lib/storage';
import { useT } from '../hooks/useLang';

export default function CreateRoom() {
  const t = useT();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [startingStack, setStartingStack] = useState('1000');
  const [maxPlayers, setMaxPlayers] = useState('8');
  const [smallBlind, setSmallBlind] = useState('10');
  const [bigBlind, setBigBlind] = useState('20');
  const [buyInAmount, setBuyInAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [turnTimer, setTurnTimer] = useState<string>('25');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const stack = Number(startingStack);
    const players = Number(maxPlayers);
    const sb = Number(smallBlind);
    const bb = Number(bigBlind);

    if (!stack || stack <= 0) { setError(t.errStartStack); return; }
    if (!players || players < 2 || players > 50) { setError(t.errPlayerCount); return; }
    if (!sb || sb <= 0 || !bb || bb <= sb) { setError(t.errBlinds); return; }

    setSubmitting(true);
    try {
      const { room, hostToken } = await createRoom(name, stack, players, sb, bb,
        buyInAmount ? Number(buyInAmount) : null, currency.trim() || null);
      saveHostToken(room.id, hostToken);
      const timerSecs = turnTimer === 'off' ? null : Number(turnTimer);
      if (timerSecs !== 25) await apiSetTurnTimer(room.id, hostToken, timerSecs);
      navigate(`/host/${room.id}`);
    } catch (err) {
      setError(translateError(err, t.errCreateRoom));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold text-ivory">{t.newTable}</h1>        </div>
        <Card className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted">{t.tableName}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.tableNamePlaceholder} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">{t.startStack}</label>
            <Input type="number" inputMode="numeric" value={startingStack} onChange={(e) => setStartingStack(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">{t.playerCount}</label>
            <Input type="number" inputMode="numeric" min={2} max={50} value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">{t.smallBlind}</label>
              <Input type="number" inputMode="numeric" value={smallBlind} onChange={(e) => setSmallBlind(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">{t.bigBlind}</label>
              <Input type="number" inputMode="numeric" value={bigBlind} onChange={(e) => setBigBlind(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">{t.buyIn}</label>
              <Input type="number" inputMode="numeric" placeholder="500" value={buyInAmount} onChange={(e) => setBuyInAmount(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">{t.currency}</label>
              <Input placeholder="UAH" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">{t.turnTimer}</label>
            <select
              value={turnTimer}
              onChange={(e) => setTurnTimer(e.target.value)}
              className="w-full rounded-xl border border-hairline/15 bg-felt-deep px-3 py-2.5 text-sm text-ivory focus:border-brass/60 focus:outline-none"
            >
              <option value="15">{t.timerSec(15)}</option>
              <option value="20">{t.timerSec(20)}</option>
              <option value="25">{t.timerSecDefault(25)}</option>
              <option value="30">{t.timerSec(30)}</option>
              <option value="45">{t.timerSec(45)}</option>
              <option value="60">{t.timerSec(60)}</option>
              <option value="90">{t.timerSec(90)}</option>
              <option value="off">{t.timerOff}</option>
            </select>
          </div>
          {error && <Banner kind="error">{error}</Banner>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t.creating : t.createBtn}
          </Button>
        </Card>
      </form>
    </div>
  );
}
