// Набор аватаров для лёгкого MVP выбора при входе за стол: 34 готовых
// изображения (без загрузки своих файлов, без аккаунтов). Картинки лежат в
// public/avatars и раздаются Vite как статика по пути /avatars/<id>.png.
// ВАЖНО: список id должен совпадать с check-constraint в
// supabase/migrations/0005_avatar_set_update.sql (расширен в 0018) — если
// меняете набор, правьте оба места синхронно (и кладите новый файл в
// public/avatars). Картинки уменьшены до 200×200 при загрузке — исходники
// присланные пользователем были 512×512, что избыточно для круглого
// аватара 36-56px на экране, только тяжелее для загрузки на телефоне.

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
  { id: 'a8', image: '/avatars/a8.png', label: 'Игрок 8' },
  { id: 'a9', image: '/avatars/a9.png', label: 'Игрок 9' },
  { id: 'a10', image: '/avatars/a10.png', label: 'Игрок 10' },
  { id: 'a11', image: '/avatars/a11.png', label: 'Игрок 11' },
  { id: 'a12', image: '/avatars/a12.png', label: 'Игрок 12' },
  { id: 'a13', image: '/avatars/a13.png', label: 'Игрок 13' },
  { id: 'a14', image: '/avatars/a14.png', label: 'Игрок 14' },
  { id: 'a15', image: '/avatars/a15.png', label: 'Игрок 15' },
  { id: 'a16', image: '/avatars/a16.png', label: 'Игрок 16' },
  { id: 'a17', image: '/avatars/a17.png', label: 'Игрок 17' },
  { id: 'a18', image: '/avatars/a18.png', label: 'Игрок 18' },
  { id: 'a19', image: '/avatars/a19.png', label: 'Игрок 19' },
  { id: 'a20', image: '/avatars/a20.png', label: 'Игрок 20' },
  { id: 'a21', image: '/avatars/a21.png', label: 'Игрок 21' },
  { id: 'a22', image: '/avatars/a22.png', label: 'Игрок 22' },
  { id: 'panda', image: '/avatars/panda.png', label: 'Панда' },
  { id: 'shark', image: '/avatars/shark.png', label: 'Акула' },
  { id: 'shiba', image: '/avatars/shiba.png', label: 'Шиба' },
  { id: 'cat', image: '/avatars/cat.png', label: 'Кот' },
  { id: 'rooster', image: '/avatars/rooster.png', label: 'Петух' },
  { id: 'wolf', image: '/avatars/wolf.png', label: 'Волк' },
  { id: 'lion', image: '/avatars/lion.png', label: 'Лев' },
  { id: 'tiger', image: '/avatars/tiger.png', label: 'Тигр' },
  { id: 'eagle', image: '/avatars/eagle.png', label: 'Орёл' },
  { id: 'bear', image: '/avatars/bear.png', label: 'Медведь' },
  { id: 'fox', image: '/avatars/fox.png', label: 'Лиса' },
  { id: 'owl', image: '/avatars/owl.png', label: 'Сова' },
];

const AVATAR_MAP = new Map(AVATARS.map((a) => [a.id, a]));

export function getAvatarImage(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return AVATAR_MAP.get(avatarId)?.image ?? null;
}

export function randomAvatarId(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)].id;
}
