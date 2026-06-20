-- StackUp: запрет на повторяющиеся имена за одним столом.
-- Раньше два игрока могли присоединиться с одинаковым (или отличающимся
-- только регистром) именем — система это прекрасно различала по id, а
-- вот человек за столом — нет: при выборе победителя, в расчёте
-- переводов, в истории раздач два «Mike» неразличимы на глаз. Теперь имя
-- проверяется на совпадение (без учёта регистра) с уже сидящими за
-- столом игроками — кто не ушёл (status='active'), тот и занимает имя.

create or replace function join_room(p_room_id uuid, p_name text, p_avatar_id text default null)
returns table (player_id uuid, player_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room    rooms;
  v_player  players;
  v_count   int;
  v_seat    int;
  v_avatars text[] := array['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'panda', 'shark', 'shiba', 'cat', 'rooster'];
  v_avatar  text;
  v_token   uuid;
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

  if exists (
    select 1 from players
    where room_id = p_room_id and status = 'active' and lower(name) = lower(trim(p_name))
  ) then
    raise exception 'Name already taken at this table';
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

  insert into player_tokens (player_id) values (v_player.id)
  returning token into v_token;

  return query select v_player.id, v_token;
end;
$$;

create or replace function host_join_room(p_room_id uuid, p_host_token uuid, p_name text, p_avatar_id text default null)
returns table (player_id uuid, player_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room    rooms;
  v_player  players;
  v_count   int;
  v_seat    int;
  v_avatars text[] := array['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'panda', 'shark', 'shiba', 'cat', 'rooster'];
  v_avatar  text;
  v_token   uuid;
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

  if exists (
    select 1 from players
    where room_id = p_room_id and status = 'active' and lower(name) = lower(trim(p_name))
  ) then
    raise exception 'Name already taken at this table';
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

  insert into player_tokens (player_id) values (v_player.id)
  returning token into v_token;

  return query select v_player.id, v_token;
end;
$$;
