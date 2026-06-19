// Простая CSS-иконка стопки фишек (3 диска внахлёст) — для банка в центре
// стола и для значка ставки игрока. Без SVG/картинок: сплошной цвет +
// пунктирное кольцо по краю, имитирующее ободок настоящей фишки.
const LAYERS = [
  { bg: 'bg-clay', edge: 'border-clay-light/70' },
  { bg: 'bg-brass', edge: 'border-brass-light/70' },
  { bg: 'bg-mint', edge: 'border-mint-light/70' },
];

export function ChipStackIcon({ size = 28 }: { size?: number }) {
  const discHeight = size * 0.34;
  const totalHeight = discHeight * 2 + size * 0.62;

  return (
    <span className="relative inline-block" style={{ width: size, height: totalHeight }} aria-hidden="true">
      {LAYERS.map((layer, idx) => (
        <span
          key={idx}
          className={`absolute left-1/2 -translate-x-1/2 rounded-full border-2 border-dashed shadow-sm ${layer.bg} ${layer.edge}`}
          style={{ width: size, height: size * 0.62, bottom: idx * discHeight }}
        />
      ))}
    </span>
  );
}
