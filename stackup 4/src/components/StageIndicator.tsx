import { useT } from '../hooks/useLang';
import type { HandStage, Street } from '../types';

function currentStageIndex(handStage: HandStage, street: Street): number {
  if (handStage === 'awaiting_winner') return 4;
  const KEYS = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  return KEYS.findIndex((s) => s === street);
}

export function StageIndicator({
  handStage, street }: { handStage: HandStage; street: Street }) {
  const t = useT();
  if (handStage === 'idle') return null;

  const STAGES = [
    { key: 'preflop', label: t.preflop },
    { key: 'flop',    label: t.flop },
    { key: 'turn',    label: t.turn },
    { key: 'river',   label: t.river },
    { key: 'showdown', label: t.showdown },
  ];

  const currentIndex = currentStageIndex(handStage, street);

  return (
    <div
      className="flex items-center justify-center gap-1.5"
      role="img"
      aria-label={t.stageAriaLabel(STAGES[currentIndex]?.label ?? '')}
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
