import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Banner, Spinner } from '../components/ui';
import { ResultsTable } from '../components/ResultsTable';
import { SettlementList } from '../components/SettlementList';
import { computeSettlement } from '../lib/settlement';
import { getResults, getRoom } from '../lib/roomApi';
import { formatChips } from '../lib/utils';
import { useT } from '../hooks/useLang';
import type { PlayerResult, Room } from '../types';

export default function Results() {
  const t = useT();
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    Promise.all([getRoom(roomId), getResults(roomId)])
      .then(([r, res]) => { setRoom(r); setResults(res); })
      .catch(() => setError(t.errRoomNotFoundShort))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  if (error || !room || !roomId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Banner kind="error">{error ?? t.errRoomNotFoundShort}</Banner>
      </div>
    );
  }

  if (room.status !== 'finished') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <Banner kind="info">{t.gameFinished}</Banner>
          <Link to={`/play/${roomId}`} className="mt-4 inline-block text-sm text-brass-light underline">
            ←
          </Link>
        </div>
      </div>
    );
  }

  const moneyPerChip =
    room.buy_in_amount != null && room.starting_stack > 0 ? room.buy_in_amount / room.starting_stack : null;

  const settlementResults: PlayerResult[] = moneyPerChip
    ? results.map((r) => ({
        ...r,
        total_buyin: Math.round(r.total_buyin * moneyPerChip),
        current_stack: Math.round(r.current_stack * moneyPerChip),
        result: Math.round(r.result * moneyPerChip),
      }))
    : results;

  const transfers = computeSettlement(settlementResults);
  const settlementUnit = moneyPerChip ? room.currency : null;
  const balance = results.reduce((sum, r) => sum + r.result, 0);

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-8">      <header className="mb-6 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">{t.resultsTitle}</p>
        <h1 className="font-display text-2xl font-semibold text-ivory">{room.name || 'StackUp'}</h1>
      </header>

      <ResultsTable results={results} moneyPerChip={moneyPerChip} currency={room.currency} />

      {balance !== 0 && (
        <p className="mt-4 text-center text-xs text-clay-light">Δ {formatChips(balance)}</p>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg text-ivory">{t.settlement}</h2>
        <SettlementList transfers={transfers} unit={settlementUnit} />
      </section>
    </div>
  );
}
