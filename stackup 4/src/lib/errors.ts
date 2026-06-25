import { detectLang } from './i18n';

// DB errors come in English — translate to Russian only when Russian is active.
// English users see the original message as-is (already in English).
const KNOWN_MESSAGES_RU: Record<string, string> = {
  'Room not found':                        'Стол не найден',
  'Room is no longer active':              'Игра уже завершена',
  'Room is not active':                    'Игра ещё не начата или уже завершена',
  'Name is required':                      'Введите имя',
  'Name already taken at this table':      'Это имя уже занято — выберите другое',
  'Room is full':                          'За столом нет свободных мест',
  'Not authorized':                        'Нет доступа — обновите страницу',
  'Need at least 2 players to start':      'Нужно минимум 2 игрока',
  'Game already started':                  'Игра уже начата',
  'Current betting round is not finished': 'Круг ставок на этой улице ещё не завершён',
  'Already on the last street':            'Это последняя улица — дальше только Showdown',
  'Player cannot act':                     'Сейчас не ваш ход',
  'Timer must be between':                 'Таймер: от 10 до 120 секунд',
};

function extractMessage(err: unknown): string | null {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return null;
}

export function translateError(err: unknown, fallback: string): string {
  const message = extractMessage(err);
  if (!message) return fallback;

  if (detectLang() === 'ru') {
    const match = Object.keys(KNOWN_MESSAGES_RU).find((key) => message.includes(key));
    if (match) return KNOWN_MESSAGES_RU[match];
  }

  // English (or unknown) — show original DB message if readable, else fallback
  return message.length < 120 ? message : fallback;
}
