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
      keyframes: {
        'win-pop': {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '15%': { opacity: '1', transform: 'scale(1.04)' },
          '25%': { transform: 'scale(1)' },
          '85%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'scale(0.98)' },
        },
        'chip-pulse': {
          '0%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
        'chip-spin': {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '70%': { transform: 'rotate(300deg) scale(1.08)' },
          '100%': { transform: 'rotate(380deg) scale(0.85)' },
        },
        'chip-arc': {
          '0%': {
            left: 'var(--chip-from-left)',
            top: 'var(--chip-from-top)',
            opacity: '1',
            transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
          },
          '45%': {
            left: 'var(--chip-mid-left)',
            top: 'var(--chip-mid-top)',
            transform: 'translate(-50%, -50%) scale(1.08) rotate(190deg)',
          },
          '85%': {
            opacity: '1',
            transform: 'translate(-50%, -50%) scale(1.18) rotate(340deg)',
          },
          '100%': {
            left: 'var(--chip-to-left)',
            top: 'var(--chip-to-top)',
            opacity: '0.15',
            transform: 'translate(-50%, -50%) scale(0.82) rotate(380deg)',
          },
        },
      },
      animation: {
        'win-pop': 'win-pop 3.2s ease-in-out forwards',
        'chip-pulse': 'chip-pulse 0.4s ease-out',
        'chip-spin': 'chip-spin 0.7s cubic-bezier(0.2, 0.6, 0.4, 1) forwards',
        'chip-arc': 'chip-arc 0.65s cubic-bezier(0.3, 0, 0.25, 1) forwards',
      },
    },
  },
  plugins: [],
};
