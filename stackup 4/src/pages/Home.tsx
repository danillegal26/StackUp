import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { useT } from '../hooks/useLang';

export default function Home() {
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">        <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted">live game companion</p>
        <h1 className="mb-4 font-display text-5xl font-semibold text-ivory">StackUp</h1>
        <p className="mb-10 text-muted">{t.homeTagline}</p>
        <Button className="w-full" onClick={() => navigate('/create')}>
          {t.homeCreateBtn}
        </Button>
      </div>
    </div>
  );
}
