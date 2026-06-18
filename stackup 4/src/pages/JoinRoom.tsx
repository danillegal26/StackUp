import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Input, Banner, Spinner } from '../components/ui';
import { getPlayerSession, savePlayerSession } from '../lib/storage';
import { getRoom, joinRoom } from '../lib/roomApi';
import { formatChips } from '../lib/utils';
import type { Room } from '../types';

export default function JoinRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const existing = getPlayerSession(roomId);
    if (existing) {
      navigate(`/play/${roomId}`, { replace: true });
      return;
    }

    getRoom(roomId)
      .then(setRoom)
      .catch(() => setLoadError('Стол не найден. Проверьте ссылку или QR-код.'))
      .finally(() => setLoading(false));
  }, [roomId, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!roomId) return;
    if (!name.trim()) {
      setError('Введите имя');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const player = await joinRoom(roomId, name.trim());
      savePlayerSession(roomId, player.id, player.name);
      navigate(`/play/${roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подключиться к столу');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Banner kind="error">{loadError ?? 'Стол не найден'}</Banner>
      </div>
    );
  }

  if (room.status === 'finished') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Banner kind="info">Эта игра уже завершена.</Banner>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted">{room.name || 'покерный стол'}</p>
        <h1 className="mb-6 font-display text-3xl font-semibold text-ivory">Присоединиться</h1>
        <Card className="space-y-4">
          <p className="text-sm text-muted">Стартовый стек: {formatChips(room.starting_stack)} фишек</p>
          <div>
            <label className="mb-1 block text-xs text-muted">Ваше имя</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Алекс" autoFocus />
          </div>
          {error && <Banner kind="error">{error}</Banner>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Подключаемся…' : 'Сесть за стол'}
          </Button>
        </Card>
      </form>
    </div>
  );
}
