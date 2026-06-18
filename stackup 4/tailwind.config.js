/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Все цвета ниже завязаны на CSS-переменные (см. src/index.css) и
        // автоматически меняются между тёмной и светлой темой.
        felt: {
          DEFAULT: 'rgb(var(--color-felt) / <alpha-value>)',
          light: 'rgb(var(--color-felt-light) / <alpha-value>)',
          deep: 'rgb(var(--color-felt-deep) / <alpha-value>)',
        },
        ivory: 'rgb(var(--color-ivory) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        brass: {
          DEFAULT: 'rgb(var(--color-brass) / <alpha-value>)',
          light: 'rgb(var(--color-brass-light) / <alpha-value>)',
        },
        clay: {
          DEFAULT: 'rgb(var(--color-clay) / <alpha-value>)',
          light: 'rgb(var(--color-clay-light) / <alpha-value>)',
        },
        // Нейтральная подложка для тонких рамок/заливок (замена литералов white/black).
        hairline: 'rgb(var(--color-hairline) / <alpha-value>)',
        // Фиксированные (не зависящие от темы) цвета текста поверх ярких
        // акцентных кнопок и QR-карточки — brass/clay всегда достаточно
        // контрастны с ними в обеих темах.
        coal: '#14110A',
        paper: '#FAF8F4',
        // Зелёное сукно стола — у физического стола цвет не меняется от
        // переключения темы интерфейса, поэтому это тоже фиксированные токены.
        table: {
          DEFAULT: '#0F5B3A',
          glow: '#19A974',
        },
        // Акцент «активности» (онлайн-индикаторы и т.д.) — задел под Этап 2,
        // где он будет обозначать игрока, чей сейчас ход.
        mint: {
          DEFAULT: '#22C55E',
          light: '#4ADE80',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
