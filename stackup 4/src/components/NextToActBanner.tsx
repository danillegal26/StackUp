import { useT } from '../hooks/useLang';

export function NextToActBanner({ name, isMe, secondsLeft }: { name: string; isMe: boolean; secondsLeft?: number | null }) {
  const t = useT();
  const urgent = secondsLeft != null && secondsLeft <= 7;

  return (
    <div className="mb-3 flex items-center justify-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]" aria-hidden="true" />
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
        {t.acting} {isMe ? <span className="font-semibold text-mint">{t.actingYou}</span> : <span className="text-ivory">{name}</span>}
      </p>
      {secondsLeft != null && (
        <span className={`font-mono text-[11px] tabular-nums ${urgent ? 'font-semibold text-clay-light' : 'text-muted'}`}>
          · {secondsLeft}{t.secondsSuffix}
        </span>
      )}
    </div>
  );
}
