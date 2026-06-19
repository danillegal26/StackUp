import { useTheme } from '../hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-hairline/20 bg-felt-light/80 text-ivory backdrop-blur-sm transition hover:border-hairline/40"
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}
