import { useMemo, useState, type ReactNode } from 'react';
import { detectLang, LANG_STORAGE_KEY, translations, type Lang } from '../lib/i18n';
import { LangContext } from '../hooks/useLang';

export function LangProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [lang, setLangState] = useState<Lang>(detectLang);

  const value = useMemo(() => {
    function setLang(l: Lang) {
      localStorage.setItem(LANG_STORAGE_KEY, l);
      setLangState(l);
    }
    return {
      ...translations[lang],
      lang,
      setLang,
      toggleLang: () => setLang(lang === 'ru' ? 'en' : 'ru'),
    };
  }, [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
