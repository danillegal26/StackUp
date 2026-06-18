import { ChipAvatar } from './ChipAvatar';
import { Button } from './ui';
import { formatChips } from '../lib/utils';
import type { Player } from '../types';

interface Props {
  player: Player;
  index: number;
  highlight?: boolean;
  onAdjust?: () => void;
  onRebuy?: () => void;
  onRemove?: () => void;
}

export function PlayerCard({ player, index, highlight, onAdjust, onRebuy, onRemove }: Props) {
  const left = player.status === 'left';

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
        left
          ? 'border-hairline/10 bg-hairline/[0.02] opacity-60'
          : highlight
            ? 'border-brass/50 bg-brass/5'
            : 'border-hairline/10 bg-hairline/[0.03]'
      }`}
    >
      <ChipAvatar name={player.name} index={index} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ivory">
          {player.name}
          {highlight ? ' (вы)' : ''}
          {left ? ' · ушёл' : ''}
        </p>
        <p className="font-mono text-lg tabular-nums text-brass-light">{formatChips(player.current_stack)}</p>
      </div>
      {!left && (onAdjust || onRebuy || onRemove) && (
        <div className="flex shrink-0 gap-2">
          {onAdjust && (
            <Button variant="secondary" size="sm" onClick={onAdjust}>
              Стек
            </Button>
          )}
          {onRebuy && (
            <Button variant="ghost" size="sm" onClick={onRebuy}>
              Rebuy
            </Button>
          )}
          {onRemove && (
            <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Убрать ${player.name} со стола`}>
              ✕
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
