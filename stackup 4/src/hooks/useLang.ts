import { useEffect, useState } from 'react';
import { detectLang, LANG_STORAGE_KEY, translations, type Lang, type Translations } from '../lib/i18n';

const LANG_CHANGE_EVENT = 'stackup:langchange';

export function setLang(lang: Lang) {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: lang }));
}

/** Возвращает словарь переводов для текущего языка + утилиты переключения. */
export function useT(): Translations & { lang: Lang; setLang: (l: Lang) => void; toggleLang: () => void } {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    const handler = (e: Event) => {
      setLangState((e as CustomEvent<Lang>).detail);
    };
    window.addEventListener(LANG_CHANGE_EVENT, handler);
    return () => window.removeEventListener(LANG_CHANGE_EVENT, handler);
  }, []);

  return {
    ...translations[lang],
    lang,
    setLang,
    toggleLang: () => setLang(lang === 'ru' ? 'en' : 'ru'),
  };
}
