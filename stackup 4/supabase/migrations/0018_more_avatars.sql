-- StackUp: расширяем набор аватаров — добавляем 15 новых «человеческих»
-- (a8..a22) и 7 новых «звериных» (wolf/lion/tiger/eagle/bear/fox/owl).
-- panda и shark остаются теми же id, но картинки под ними заменены на
-- более качественные (см. public/avatars/panda.png, shark.png) — здесь
-- в базе это не требует изменений, id не поменялся.
-- ВАЖНО: список id ниже должен совпадать с src/lib/avatars.ts.
-- Как и в 0005 — старую функцию/constraint не трогаем напрямую, а
-- пересоздаём (create or replace / drop+add constraint).

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'players'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%avatar_id%';
  if v_conname is not null then
    execute format('alter table players drop constraint %I', v_conname);
  end if;
end $$;

alter table players add constraint players_avatar_id_check
  check (
    avatar_id is null
    or avatar_id in (
      'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10',
      'a11', 'a12', 'a13', 'a14', 'a15', 'a16', 'a17', 'a18', 'a19', 'a20',
      'a21', 'a22',
      'panda', 'shark', 'shiba', 'cat', 'rooster',
      'wolf', 'lion', 'tiger', 'eagle', 'bear', 'fox', 'owl'
    )
  );

create or replace function join_room(p_room_id uuid, p_name text, p_avatar_id text default null)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room    rooms;
  v_player  players;
  v_count   int;
  v_seat    int;
  v_avatars text[] := array[
    'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10',
    'a11', 'a12', 'a13', 'a14', 'a15', 'a16', 'a17', 'a18', 'a19', 'a20',
    'a21', 'a22',
    'panda', 'shark', 'shiba', 'cat', 'rooster',
    'wolf', 'lion', 'tiger', 'eagle', 'bear', 'fox', 'owl'
  ];
  v_avatar  text;
begin
  select * into v_room from rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;
  if v_room.status = 'finished' then
    raise exception 'Room is no longer active';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Name is required';
  end if;

  select count(*) into v_count from players where room_id = p_room_id and status = 'active';
  if v_count >= v_room.max_players then
    raise exception 'Room is full';
  end if;

  select coalesce(max(seat_index), -1) + 1 into v_seat from players where room_id = p_room_id;

  if p_avatar_id is not null and p_avatar_id = any(v_avatars) then
    v_avatar := p_avatar_id;
  else
    v_avatar := v_avatars[1 + floor(random() * array_length(v_avatars, 1))::int];
  end if;

  insert into players (room_id, name, current_stack, seat_index, avatar_id)
  values (p_room_id, trim(p_name), v_room.starting_stack, v_seat, v_avatar)
  returning * into v_player;

  insert into transactions (room_id, player_id, type, amount)
  values (p_room_id, v_player.id, 'buyin', v_room.starting_stack);

  return v_player;
end;
$$;

create or replace function host_join_room(p_room_id uuid, p_host_token uuid, p_name text, p_avatar_id text default null)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room    rooms;
  v_player  players;
  v_count   int;
  v_seat    int;
  v_avatars text[] := array[
    'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10',
    'a11', 'a12', 'a13', 'a14', 'a15', 'a16', 'a17', 'a18', 'a19', 'a20',
    'a21', 'a22',
    'panda', 'shark', 'shiba', 'cat', 'rooster',
    'wolf', 'lion', 'tiger', 'eagle', 'bear', 'fox', 'owl'
  ];
  v_avatar  text;
begin
  if not _check_host(p_room_id, p_host_token) then
    raise exception 'Not authorized';
  end if;

  select * into v_room from rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;
  if v_room.status = 'finished' then
    raise exception 'Room is no longer active';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Name is required';
  end if;

  select count(*) into v_count from players where room_id = p_room_id and status = 'active';
  if v_count >= v_room.max_players then
    raise exception 'Room is full';
  end if;

  select coalesce(max(seat_index), -1) + 1 into v_seat from players where room_id = p_room_id;

  if p_avatar_id is not null and p_avatar_id = any(v_avatars) then
    v_avatar := p_avatar_id;
  else
    v_avatar := v_avatars[1 + floor(random() * array_length(v_avatars, 1))::int];
  end if;

  insert into players (room_id, name, current_stack, seat_index, is_host, avatar_id)
  values (p_room_id, trim(p_name), v_room.starting_stack, v_seat, true, v_avatar)
  returning * into v_player;

  insert into transactions (room_id, player_id, type, amount)
  values (p_room_id, v_player.id, 'buyin', v_room.starting_stack);

  return v_player;
end;
$$;
