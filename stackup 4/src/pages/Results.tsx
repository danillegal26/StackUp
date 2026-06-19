import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Banner, Spinner } from '../components/ui';
import { ResultsTable } from '../components/ResultsTable';
import { getResults, getRoom } from '../lib/roomApi';
import { formatChips } from '../lib/utils';
import type { PlayerResult, Room } from '../types';

export default function Results() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    Promise.all([getRoom(roomId), getResults(roomId)])
      .then(([r, res]) => {
        setRoom(r);
        setResults(res);
      })
      .catch(() => setError('Не удалось загрузить итоги'))
      .finally(() => setLoading(false));
  }, [roomId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !room || !roomId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Banner kind="error">{error ?? 'Стол не найден'}</Banner>
      </div>
    );
  }

  if (room.status !== 'finished') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <Banner kind="info">Игра ещё идёт. Итоги появятся, когда организатор её завершит.</Banner>
          <Link to={`/play/${roomId}`} className="mt-4 inline-block text-sm text-brass-light underline">
            Вернуться к столу
          </Link>
        </div>
      </div>
    );
  }

  const balance = results.reduce((sum, r) => sum + r.result, 0);

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-8">
      <header className="mb-6 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">итоги игры</p>
        <h1 className="font-display text-2xl font-semibold text-ivory">{room.name || 'Покерный стол'}</h1>
      </header>

      <ResultsTable results={results} />

      <p className="mt-6 text-center text-xs text-muted">
        {balance === 0 ? 'Баланс стола сходится ✓' : `Расхождение баланса: ${formatChips(balance)} — проверьте записи`}
      </p>
    </div>
  );
}
