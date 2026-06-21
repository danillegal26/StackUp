import type { HandStage, Street } from '../types';

// Полоска из 5 стадий раздачи (Префлоп/Флоп/Тёрн/Ривер/Вскрытие) — текущая
// и уже пройденные подсвечены, будущие приглушены. Карты при этом
// полностью физические, это просто индикатор «где мы сейчас» для всех за
// столом, не более того. Список стадий статичный (не пытаемся типизировать
// смешанный массив Street + 'showdown' — проще и надёжнее перечислить явно).
const STAGES: { key: string; label: string }[] = [
  { key: 'preflop', label: 'Префлоп' },
  { key: 'flop', label: 'Флоп' },
  { key: 'turn', label: 'Тёрн' },
  { key: 'river', label: 'Ривер' },
  { key: 'showdown', label: 'Вскрытие' },
];

function currentStageIndex(handStage: HandStage, street: Street): number {
  if (handStage === 'awaiting_winner') return 4;
  return STAGES.findIndex((s) => s.key === street);
}

export function StageIndicator({ handStage, street }: { handStage: HandStage; street: Street }) {
  if (handStage === 'idle') return null;

  const currentIndex = currentStageIndex(handStage, street);

  return (
    <div
      className="flex items-center justify-center gap-1.5"
      role="img"
      aria-label={`Стадия раздачи: ${STAGES[currentIndex]?.label ?? ''}`}
    >
      {STAGES.map((stage, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <span
            key={stage.key}
            className={`font-mono text-[10px] uppercase tracking-wide transition ${
              isCurrent ? 'font-semibold text-mint' : isPast ? 'text-ivory/50' : 'text-muted/40'
            }`}
          >
            {stage.label}
            {i < STAGES.length - 1 && <span className="ml-1.5 text-muted/30">→</span>}
          </span>
        );
      })}
    </div>
  );
}
