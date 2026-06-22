// Реалистичная казинная фишка на SVG: чередующиеся «зубцы» по краю
// (классический рисунок краёв настоящей фишки — имитируется пунктирным
// обводом с толстым контрастным штрихом), внутреннее кольцо, маленький
// медальон в центре и блик сверху для объёма. Раньше это были плоские
// CSS-кружки с пунктирной рамкой — выглядело гораздо более «иконочно»,
// чем «как настоящая фишка».
//
// Стопка (несколько фишек) рисуется тем же вертикальным нахлёстом, что и
// раньше (каждая следующая фишка перекрывает предыдущую примерно
// наполовину) — так нижний край каждой нижней фишки остаётся виден
// колечком снизу-под верхней, что и даёт ощущение объёмной стопки, а не
// плоского веера.
const PALETTE = [
  { main: '#B91C1C', edge: '#FEE2E2' }, // красная — классическая «номинальная» фишка
  { main: '#15803D', edge: '#DCFCE7' }, // зелёная
  { main: '#171717', edge: '#E5E7EB' }, // чёрная
  { main: '#6D28D9', edge: '#EDE9FE' }, // фиолетовая
  { main: '#F8FAFC', edge: '#1E293B' }, // белая — у неё кант, наоборот, тёмный для контраста
];

function ChipFace({ size, palette }: { size: number; palette: (typeof PALETTE)[number] }) {
  const r = size / 2 - size * 0.08;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block overflow-visible">
      <circle cx={c} cy={c} r={r} fill={palette.main} stroke={palette.main} strokeWidth={size * 0.05} />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={palette.edge}
        strokeWidth={size * 0.16}
        strokeDasharray={`${size * 0.17} ${size * 0.13}`}
      />
      <circle cx={c} cy={c} r={r * 0.6} fill="none" stroke={palette.edge} strokeWidth={Math.max(0.75, size * 0.025)} opacity="0.7" />
      <circle cx={c} cy={c} r={r * 0.42} fill={palette.main} stroke={palette.edge} strokeWidth={Math.max(1, size * 0.04)} />
      <ellipse cx={c - r * 0.32} cy={c - r * 0.38} rx={r * 0.32} ry={r * 0.16} fill="#fff" opacity="0.28" />
    </svg>
  );
}

const WHITE_INDEX = 4;

export function ChipStackIcon({
  size = 28,
  count = 3,
  colorIndex,
  twoTone = false,
}: {
  size?: number;
  count?: number;
  colorIndex?: number;
  /** Чередовать colorIndex с белой фишкой через слой — даёт чистую
   *  «двухцветную» стопку (как в реальном казино: один номинал + белая
   *  между ними для удобного подсчёта), а не радужный цикл по всем 5
   *  цветам подряд. Требует colorIndex. */
  twoTone?: boolean;
}) {
  const n = Math.max(1, Math.min(count, 10));
  const discHeight = size * 0.34;
  const totalHeight = discHeight * (n - 1) + size;

  return (
    <span className="relative inline-block" style={{ width: size, height: totalHeight }} aria-hidden="true">
      {Array.from({ length: n }).map((_, idx) => {
        const paletteIdx =
          twoTone && colorIndex != null
            ? idx % 2 === 0
              ? colorIndex
              : WHITE_INDEX
            : (colorIndex ?? idx) % PALETTE.length;
        return (
          <span
            key={idx}
            className="absolute left-1/2 -translate-x-1/2 drop-shadow-sm"
            style={{ bottom: idx * discHeight }}
          >
            <ChipFace size={size} palette={PALETTE[paletteIdx]} />
          </span>
        );
      })}
    </span>
  );
}
