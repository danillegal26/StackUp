import { useT } from '../hooks/useLang';

/** Кнопка смены языка — без absolute-позиционирования, ставится в поток */
export function LangToggle({ className = '' }: { className?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={t.toggleLang}
      aria-label={t.lang === 'ru' ? 'Switch to English' : 'Switch to Russian'}
      className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-lg border border-hairline/15 bg-felt-light/60 font-mono text-xs font-semibold text-muted transition hover:border-hairline/30 hover:text-ivory active:scale-95 ${className}`}
    >
      {t.langLabel}
    </button>
  );
}
