// Простая CSS-иконка стопки фишек (несколько дисков внахлёст) — для
// банка в центре стола, для значка ставки игрока и для «стопки на
// столе» перед каждым игроком. Без SVG/картинок: сплошной цвет +
// пунктирное кольцо по краю, имитирующее ободок настоящей фишки.
const COLORS = [
  { bg: 'bg-clay', edge: 'border-clay-light/70' },
  { bg: 'bg-brass', edge: 'border-brass-light/70' },
  { bg: 'bg-mint', edge: 'border-mint-light/70' },
];

export function ChipStackIcon({ size = 28, count = 3 }: { size?: number; count?: number }) {
  const n = Math.max(1, Math.min(count, 10));
  const discHeight = size * 0.3;
  const totalHeight = discHeight * (n - 1) + size * 0.62;

  return (
    <span className="relative inline-block" style={{ width: size, height: totalHeight }} aria-hidden="true">
      {Array.from({ length: n }).map((_, idx) => {
        const color = COLORS[idx % COLORS.length];
        return (
          <span
            key={idx}
            className={`absolute left-1/2 -translate-x-1/2 rounded-full border-2 border-dashed shadow-sm ${color.bg} ${color.edge}`}
            style={{ width: size, height: size * 0.62, bottom: idx * discHeight }}
          />
        );
      })}
    </span>
  );
}
