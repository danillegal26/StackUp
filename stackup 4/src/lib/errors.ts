// Supabase передаёт текст RAISE EXCEPTION из PL/pgSQL как есть, на
// английском — этот словарь переводит известные сообщения на русский,
// чтобы не показывать игроку сырой текст ошибки базы данных. Неизвестные
// ошибки по-прежнему показываются как есть (лучше английский текст, чем
// ничего) — это не претендует на полноту, только самые частые случаи.
const KNOWN_MESSAGES: Record<string, string> = {
  'Room not found': 'Стол не найден',
  'Room is no longer active': 'Игра уже завершена',
  'Name is required': 'Введите имя',
  'Name already taken at this table': 'Это имя уже занято за этим столом — выберите другое',
  'Room is full': 'За столом нет свободных мест',
  'Not authorized': 'Нет доступа — попробуйте обновить страницу',
};

export function translateError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const match = Object.keys(KNOWN_MESSAGES).find((key) => err.message.includes(key));
    return match ? KNOWN_MESSAGES[match] : err.message;
  }
  return fallback;
}
