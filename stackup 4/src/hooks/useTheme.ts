import { useState } from 'react';
import { applyTheme, getCurrentTheme, type Theme } from '../lib/theme';

export function useTheme() {
  // Тема уже применена синхронным скриптом в index.html до маунта React —
  // здесь просто читаем актуальное состояние, без useEffect и мигания.
  const [theme, setThemeState] = useState<Theme>(getCurrentTheme);

  function setTheme(next: Theme) {
    applyTheme(next);
    setThemeState(next);
  }

  function toggle() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return { theme, setTheme, toggle };
}
