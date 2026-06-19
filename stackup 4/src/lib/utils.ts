export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatChips(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n);
}

export function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

export const CHIP_COLORS = ['#C9A227', '#3E7C59', '#3B5BA9', '#C1453D', '#9456A3', '#D98A3D'];

export function chipColorForIndex(i: number): string {
  return CHIP_COLORS[i % CHIP_COLORS.length];
}
