import type { ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-hairline/10 bg-felt-light p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ivory">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full p-2 text-muted hover:bg-hairline/10 hover:text-ivory"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
