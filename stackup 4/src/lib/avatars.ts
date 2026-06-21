// Набор аватаров для лёгкого MVP выбора при входе за стол: 12 готовых
// изображений (без загрузки своих файлов, без аккаунтов). Картинки лежат в
// public/avatars и раздаются Vite как статика по пути /avatars/<id>.png.
// ВАЖНО: список id должен совпадать с check-constraint в
// supabase/migrations/0005_avatar_set_update.sql — если меняете набор,
// правьте оба места синхронно (и кладите новый файл в public/avatars).

export interface AvatarOption {
  id: string;
  image: string;
  label: string;
}

export const AVATARS: AvatarOption[] = [
  { id: 'a1', image: '/avatars/a1.png', label: 'Игрок 1' },
  { id: 'a2', image: '/avatars/a2.png', label: 'Игрок 2' },
  { id: 'a3', image: '/avatars/a3.png', label: 'Игрок 3' },
  { id: 'a4', image: '/avatars/a4.png', label: 'Игрок 4' },
  { id: 'a5', image: '/avatars/a5.png', label: 'Игрок 5' },
  { id: 'a6', image: '/avatars/a6.png', label: 'Игрок 6' },
  { id: 'a7', image: '/avatars/a7.png', label: 'Игрок 7' },
  { id: 'panda', image: '/avatars/panda.png', label: 'Панда' },
  { id: 'shark', image: '/avatars/shark.png', label: 'Акула' },
  { id: 'shiba', image: '/avatars/shiba.png', label: 'Шиба' },
  { id: 'cat', image: '/avatars/cat.png', label: 'Кот' },
  { id: 'rooster', image: '/avatars/rooster.png', label: 'Петух' },
];

const AVATAR_MAP = new Map(AVATARS.map((a) => [a.id, a]));

export function getAvatarImage(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return AVATAR_MAP.get(avatarId)?.image ?? null;
}

export function randomAvatarId(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)].id;
}
