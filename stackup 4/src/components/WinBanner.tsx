import { formatChips } from '../lib/utils';
import type { WinBannerData } from '../hooks/useWinBanner';

export function WinBanner({ data }: { data: WinBannerData }) {
  const text = data.names.length === 1 ? data.names[0] : data.names.join(' и ');

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      aria-live="polite"
    >
      <div className="animate-win-pop rounded-2xl border border-brass/50 bg-felt-deep/95 px-6 py-4 text-center shadow-[0_0_40px_-4px_rgba(245,158,11,0.5)]">
        <p className="font-display text-lg font-semibold text-brass-light">{text} забирает банк</p>
        <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-ivory">+{formatChips(data.amount)}</p>
      </div>
    </div>
  );
}
