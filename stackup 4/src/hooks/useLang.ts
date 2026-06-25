import { createContext, useContext } from 'react';
import { type Lang, type Translations } from '../lib/i18n';

export type LangContextValue = Translations & {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
};

// Контекст создаётся здесь, провайдер — в App.tsx.
// useT() просто читает из контекста — один источник правды,
// ноль CustomEvent-подписок, React сам отслеживает зависимости.
export const LangContext = createContext<LangContextValue | null>(null);

export function useT(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useT must be used inside LangProvider (App.tsx)');
  return ctx;
}
