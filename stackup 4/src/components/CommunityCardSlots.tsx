import type { HandStage, Street } from '../types';

// 5 силуэтов общих карт в центре стола — НЕ показывают значения карт
// (приложение их не знает и не должно знать), просто подсвечивают,
// сколько уже физически открыто на столе по текущей улице: 0 на
// префлопе, 3 на флопе, 4 на тёрне, 5 на ривере/вскрытии. Открытые
// светлее и с рамкой акцентного цвета, ещё не сданные — пунктирные и
// приглушённые.
function revealedCount(handStage: HandStage, street: Street): number {
  if (handStage === 'idle') return 0;
  if (handStage === 'awaiting_winner') return 5;
  switch (street) {
    case 'preflop':
      return 0;
    case 'flop':
      return 3;
    case 'turn':
      return 4;
    case 'river':
      return 5;
    default:
      return 0;
  }
}

export function CommunityCardSlots({ handStage, street }: { handStage: HandStage; street: Street }) {
  if (handStage === 'idle') return null;

  const revealed = revealedCount(handStage, street);

  return (
    <div className="flex items-center justify-center gap-1" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => {
        const isRevealed = i < revealed;
        return (
          <div
            key={i}
            className={`h-5 w-3.5 rounded-[2px] border transition-colors ${
              isRevealed ? 'border-brass-light/70 bg-paper/15' : 'border-dashed border-hairline/25 bg-transparent'
            }`}
          />
        );
      })}
    </div>
  );
}
