import { chipColorForIndex, shadeColor } from '../lib/utils';

interface Props {
  name: string;
  index: number;
  size?: number;
  /** URL картинки выбранного аватара (см. src/lib/avatars.ts); если не задан — показываются инициалы. */
  avatar?: string | null;
}

export function ChipAvatar({ name, index, size = 44, avatar }: Props) {
  const t = useT();
  const color = chipColorForIndex(index);
  const dark = shadeColor(color, -18);
  const initials = name.trim().slice(0, 2).toUpperCase() || '??';

  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `repeating-conic-gradient(${color} 0deg 18deg, ${dark} 18deg 36deg)`,
        // Светлое кольцо фиксировано и не зависит от темы — у физических фишек
        // ободок не «темнеет» от смены освещения в комнате.
        boxShadow: 'inset 0 0 0 4px rgba(245,241,230,0.92), 0 2px 6px rgba(0,0,0,0.35)',
      }}
      aria-hidden="true"
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="rounded-full object-cover"
          style={{ width: size - 8, height: size - 8 }}
        />
      ) : (
        <span className="font-display font-semibold text-coal" style={{ fontSize: size * 0.32 }}>
          {initials}
        </span>
      )}
    </div>
  );
}
