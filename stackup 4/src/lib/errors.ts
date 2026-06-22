// Supabase передаёт текст RAISE EXCEPTION из PL/pgSQL как есть, на
// английском — этот словарь переводит известные сообщения на русский,
// чтобы не показывать игроку сырой текст ошибки базы данных. Неизвестные
// ошибки по-прежнему показываются как есть (лучше английский текст, чем
// ничего) — это не претендует на полноту, только самые частые случаи.
// Supabase передаёт текст RAISE EXCEPTION из PL/pgSQL как есть, на
// английском — этот словарь переводит известные сообщения на русский,
// чтобы не показывать игроку сырой текст ошибки базы данных. Неизвестные
// ошибки по-прежнему показываются как есть (лучше английский текст, чем
// ничего) — это не претендует на полноту, только самые частые случаи.
const KNOWN_MESSAGES: Record<string, string> = {
  'Room not found': 'Стол не найден',
  'Room is no longer active': 'Игра уже завершена',
  'Room is not active': 'Игра ещё не начата или уже завершена',
  'Name is required': 'Введите имя',
  'Name already taken at this table': 'Это имя уже занято за этим столом — выберите другое',
  'Room is full': 'За столом нет свободных мест',
  'Not authorized': 'Нет доступа — попробуйте обновить страницу',
  'Need at least 2 players to start': 'Нужно минимум 2 игрока, чтобы начать игру',
  'Game already started': 'Игра уже начата',
  'Current betting round is not finished yet': 'Круг торгов на этой улице ещё не завершён',
  'Already on the last street': 'Это уже последняя улица — дальше только вскрытие',
};

// Достаём текст ошибки максимально терпимо к форме объекта: обычный
// Error, объект с полем message (например PostgrestError из supabase-js,
// если по какой-то причине он не прошёл chain до настоящего Error), или
// просто строка — в любом случае стараемся показать игроку РЕАЛЬНУЮ
// причину, а не молча скатываться в generic-фоллбэк, который ничем не
// помогает ни игроку, ни при разборе бага.
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
  const match = Object.keys(KNOWN_MESSAGES).find((key) => message.includes(key));
  return match ? KNOWN_MESSAGES[match] : message;
}
