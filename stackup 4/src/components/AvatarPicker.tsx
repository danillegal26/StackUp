import { AVATARS } from '../lib/avatars';
import { cn } from '../lib/utils';

interface Props {
  value: string | null;
  onChange: (avatarId: string) => void;
  className?: string;
}

export function AvatarPicker({ value, onChange, className }: Props) {
  const t = useT();
  return (
    <div className={cn('grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-7', className)}>
      {AVATARS.map((a) => {
        const selected = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            aria-label={a.label}
            aria-pressed={selected}
            className={cn(
              'aspect-square overflow-hidden rounded-xl border-2 transition',
              selected ? 'border-brass ring-2 ring-brass' : 'border-hairline/15 hover:border-hairline/30'
            )}
          >
            <img src={a.image} alt={a.label} className="h-full w-full object-cover" />
          </button>
        );
      })}
    </div>
  );
}
