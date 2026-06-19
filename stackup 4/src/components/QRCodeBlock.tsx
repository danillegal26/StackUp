import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export function QRCodeBlock({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    // Карточка с QR-кодом намеренно всегда светлая (paper/coal), независимо
    // от темы приложения — это нужно для контраста и сканируемости кода.
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-coal/10 bg-paper p-5">
      <QRCodeSVG value={url} size={180} bgColor="#FAF8F4" fgColor="#14110A" level="M" />
      <p className="break-all text-center font-mono text-xs text-coal">{url}</p>
      <button
        onClick={copyLink}
        className="min-h-[48px] rounded-xl border border-coal/30 px-4 py-3 text-sm font-semibold text-coal transition hover:border-coal"
      >
        {copied ? 'Скопировано' : 'Скопировать ссылку'}
      </button>
    </div>
  );
}
