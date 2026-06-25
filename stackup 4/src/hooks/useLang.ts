import { useEffect, useState } from 'react';
import { detectLang, LANG_STORAGE_KEY, translations, type Lang, type Translations } from '../lib/i18n';

const LANG_EVENT = 'stackup:lang';

export function setLang(lang: Lang) {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: lang }));
}

export type LangContextValue = Translations & {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
};

export function useT(): LangContextValue {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    const handler = (e: Event) => setLangState((e as CustomEvent<Lang>).detail);
    window.addEventListener(LANG_EVENT, handler);
    return () => window.removeEventListener(LANG_EVENT, handler);
  }, []);

  return {
    ...translations[lang],
    lang,
    setLang,
    toggleLang: () => setLang(lang === 'ru' ? 'en' : 'ru'),
  };
}
