import { useT } from '../hooks/useLang';

export function LangToggle() {
  const t = useT();
  return (
    <button
      onClick={t.toggleLang}
      aria-label={t.lang === 'ru' ? 'Switch to English' : 'Переключить на русский'}
      className="flex h-8 w-10 items-center justify-center rounded-lg border border-hairline/15 bg-felt-light/60 font-mono text-xs font-semibold text-muted transition hover:border-hairline/30 hover:text-ivory active:scale-95"
    >
      {t.langLabel}
    </button>
  );
}
