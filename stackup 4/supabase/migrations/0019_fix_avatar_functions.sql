-- StackUp: чинит ошибку применения 0018 —
--   ERROR 42P13: cannot change return type of existing function
--   HINT: Use DROP FUNCTION join_room(uuid,text,text) first.
-- create or replace не может поменять тип возврата существующей функции,
-- а Postgres в этом случае считает типы разными, хотя текст определения
-- (returns players) не менялся. Раз в SQL Editor скрипт не оборачивается
-- в одну транзакцию автоматически — constraint из 0018 (он шёл первым)
-- скорее всего уже применился, а выполнение остановилось именно на
-- create or replace function join_room. Эта миграция чинит только
-- функции — явно дропаем обе перед пересозданием, дальше снова можно
-- спокойно использовать create or replace при будущих правках, раз
-- сигнатура и тип возврата теперь зафиксированы.

drop function if exists join_room(uuid, text, text);
drop function if exists host_join_room(uuid, uuid, text, text);

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
