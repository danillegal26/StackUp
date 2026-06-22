-- StackUp: выбор аватара при входе за стол.
-- Лёгкий MVP: фиксированный набор из 10 эмодзи-аватаров.
-- ВАЖНО: список id ниже должен совпадать с src/lib/avatars.ts — если меняете
-- набор аватаров, правьте оба места синхронно.

alter table players add column if not exists avatar_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'players_avatar_id_check'
  ) then
    alter table players add constraint players_avatar_id_check
      check (
        avatar_id is null
        or avatar_id in ('fox', 'panda', 'tiger', 'lion', 'wolf', 'shark', 'dragon', 'eagle', 'cat', 'bear')
      );
  end if;
end $$;

-- ============================================================
-- join_room / host_join_room: добавляем необязательный p_avatar_id.
-- Сигнатура меняется (добавился параметр) — это для Postgres другая
-- функция, а не замена старой, поэтому сначала дропаем старые версии,
-- иначе получим два перегруженных join_room и PostgREST не сможет
-- однозначно выбрать нужную при вызове через RPC.
-- Если аватар не передан или невалиден — сервер сам выберет случайный
-- из того же списка (защита на случай прямого вызова API без аватара).
-- ============================================================

drop function if exists join_room(uuid, text);
drop function if exists host_join_room(uuid, uuid, text);

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
  v_avatars text[] := array['fox', 'panda', 'tiger', 'lion', 'wolf', 'shark', 'dragon', 'eagle', 'cat', 'bear'];
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

grant execute on function join_room(uuid, text, text) to anon;

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
  v_avatars text[] := array['fox', 'panda', 'tiger', 'lion', 'wolf', 'shark', 'dragon', 'eagle', 'cat', 'bear'];
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

grant execute on function host_join_room(uuid, uuid, text, text) to anon;
