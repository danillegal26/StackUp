import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Input, Banner, Spinner } from '../components/ui';
import { AvatarPicker } from '../components/AvatarPicker';
import { LangToggle } from '../components/LangToggle';
import { getPlayerSession, savePlayerSession } from '../lib/storage';
import { getRoom, joinRoom } from '../lib/roomApi';
import { formatChips } from '../lib/utils';
import { translateError } from '../lib/errors';
import { randomAvatarId } from '../lib/avatars';
import { useT } from '../hooks/useLang';
import type { Room } from '../types';

export default function JoinRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const t = useT();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<'name' | 'avatar'>('name');
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultAvatar = useMemo(() => randomAvatarId(), []);

  useEffect(() => {
    if (!roomId) return;
    const existing = getPlayerSession(roomId);
    if (existing) { navigate(`/play/${roomId}`, { replace: true }); return; }
    getRoom(roomId)
      .then(setRoom)
      .catch(() => setLoadError(t.errRoomNotFound))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, navigate]);

  function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(t.errJoinNameRequired); return; }
    setError(null);
    setAvatarId(defaultAvatar);
    setStep('avatar');
  }

  async function handleJoin() {
    if (!roomId) return;
    setSubmitting(true);
    setError(null);
    try {
      const { playerId, playerToken } = await joinRoom(roomId, name.trim(), avatarId ?? defaultAvatar);
      savePlayerSession(roomId, playerId, playerToken, name.trim());
      navigate(`/play/${roomId}`);
    } catch (err) {
      setError(translateError(err, t.errJoinRoom));
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Banner kind="error">{loadError ?? t.errRoomNotFoundShort}</Banner>
      </div>
    );
  }

  if (room.status === 'finished') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Banner kind="info">{t.gameFinished}</Banner>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="absolute right-4 top-4"><LangToggle /></div>
      <div className="w-full max-w-sm">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted">{room.name || 'StackUp'}</p>
        <h1 className="mb-6 font-display text-3xl font-semibold text-ivory">{t.joinTitle}</h1>

        {step === 'name' && (
          <form onSubmit={handleNameSubmit}>
            <Card className="space-y-4">
              <p className="text-sm text-muted">{t.joinStartStack(formatChips(room.starting_stack))}</p>
              <div>
                <label className="mb-1 block text-xs text-muted">{t.yourName}</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} autoFocus />
              </div>
              {error && <Banner kind="error">{error}</Banner>}
              <Button type="submit" className="w-full">{t.next}</Button>
            </Card>
          </form>
        )}

        {step === 'avatar' && (
          <Card className="space-y-4">
            <div>
              <p className="mb-1 text-sm text-ivory">{t.chooseAvatar}</p>
              <p className="text-xs text-muted">{t.avatarHint}</p>
            </div>
            <AvatarPicker value={avatarId} onChange={setAvatarId} />
            {error && <Banner kind="error">{error}</Banner>}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep('name')} disabled={submitting}>
                {t.back}
              </Button>
              <Button type="button" className="flex-1" onClick={handleJoin} disabled={submitting}>
                {submitting ? t.joining : t.joinBtn}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
