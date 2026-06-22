-- StackUp: Этап 1 — настоящий покерный стол.
-- Хост может сесть за стол как игрок, появляется лобби перед стартом игры,
-- места за столом, дилер-баттон, малый/большой блайнд с авто-ротацией.
-- Реальные ставки/банк/раздачи — это следующий этап; здесь только
-- визуальная механика и подготовка данных под неё.

-- ============================================================
-- НОВЫЕ КОЛОНКИ
-- ============================================================

alter table players add column if not exists seat_index integer not null default 0;
alter table players add column if not exists is_host boolean not null default false;

alter table rooms add column if not exists currency text;
alter table rooms add column if not exists buy_in_amount integer;
alter table rooms add column if not exists small_blind integer;
alter table rooms add column if not exists big_blind integer;
alter table rooms add column if not exists dealer_player_id uuid references players(id) on delete set null;
alter table rooms add column if not exists hand_number integer not null default 0;

-- Расширяем допустимые статусы комнаты: добавляется 'lobby' (до старта игры).
-- Имя check-constraint на status могло отличаться, поэтому находим его
-- динамически, а не угадываем имя.
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'rooms'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if v_conname is not null then
    execute format('alter table rooms drop constraint %I', v_conname);
  end if;
end $$;

alter table rooms add constraint rooms_status_check check (status in ('lobby', 'active', 'finished'));

-- ============================================================
-- create_room: теперь принимает блайнды/бай-ин/валюту и создаёт
-- комнату сразу в статусе 'lobby'. Возвращает только id и host_token —
-- остальное клиент получает обычным select после создания.
-- ============================================================

drop function if exists create_room(text, int, int);

create or replace function create_room(
  p_name text,
  p_starting_stack int,
  p_max_players int,
  p_small_blind int default null,
  p_big_blind int default null,
  p_buy_in_amount int default null,
  p_currency text default null
)
returns table (id uuid, host_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_token uuid;
begin
  if p_starting_stack is null or p_starting_stack <= 0 then
    raise exception 'starting_stack must be positive';
  end if;
  if p_max_players is null or p_max_players < 2 or p_max_players > 50 then
    raise exception 'max_players must be between 2 and 50';
  end if;
  if p_small_blind is not null and p_small_blind <= 0 then
    raise exception 'small_blind must be positive';
  end if;
  if p_big_blind is not null and (p_small_blind is null or p_big_blind <= p_small_blind) then
    raise exception 'big_blind must be greater than small_blind';
  end if;

  insert into rooms (name, starting_stack, max_players, status, small_blind, big_blind, buy_in_amount, currency)
  values (
    nullif(trim(p_name), ''), p_starting_stack, p_max_players, 'lobby',
    p_small_blind, p_big_blind, p_buy_in_amount, nullif(trim(coalesce(p_currency, '')), '')
  )
  returning rooms.id into v_room_id;

  insert into room_hosts (room_id) values (v_room_id)
  returning room_hosts.host_token into v_token;

  return query select v_room_id, v_token;
end;
$$;

grant execute on function create_room(text, int, int, int, int, int, text) to anon;

-- ============================================================
-- join_room: теперь назначает место за столом (seat_index) и считает
-- лимит игроков только по активным (ушедшие освобождают место).
-- Разрешаем вход и в лобби, и во время игры — блокируем только finished.
-- ============================================================

create or replace function join_room(p_room_id uuid, p_name text)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room   rooms;
  v_player players;
  v_count  int;
  v_seat   int;
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

  insert into players (room_id, name, current_stack, seat_index)
  values (p_room_id, trim(p_name), v_room.starting_stack, v_seat)
  returning * into v_player;

  insert into transactions (room_id, player_id, type, amount)
  values (p_room_id, v_player.id, 'buyin', v_room.starting_stack);

  return v_player;
end;
$$;

-- ============================================================
-- host_join_room: хост садится за стол как игрок, сохраняя права
-- администратора (host_token остаётся отдельно, не теряется).
-- ============================================================

create or replace function host_join_room(p_room_id uuid, p_host_token uuid, p_name text)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room   rooms;
  v_player players;
  v_count  int;
  v_seat   int;
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

  insert into players (room_id, name, current_stack, seat_index, is_host)
  values (p_room_id, trim(p_name), v_room.starting_stack, v_seat, true)
  returning * into v_player;

  insert into transactions (room_id, player_id, type, amount)
  values (p_room_id, v_player.id, 'buyin', v_room.starting_stack);

  return v_player;
end;
$$;

grant execute on function host_join_room(uuid, uuid, text) to anon;

-- ============================================================
-- adjust_stack / add_rebuy: теперь блокируем только когда игра завершена
-- (а не только когда статус не 'active'), чтобы хост мог настраивать
-- стеки и во время лобби.
-- ============================================================

create or replace function adjust_stack(p_room_id uuid, p_host_token uuid, p_player_id uuid, p_amount int)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room   rooms;
  v_player players;
begin
  if not _check_host(p_room_id, p_host_token) then
    raise exception 'Not authorized';
  end if;

  select * into v_room from rooms where id = p_room_id;
  if not found or v_room.status = 'finished' then
    raise exception 'Room is not active';
  end if;

  select * into v_player from players where id = p_player_id and room_id = p_room_id;
  if not found then
    raise exception 'Player not found';
  end if;

  if v_player.current_stack + p_amount < 0 then
    raise exception 'Stack cannot go negative';
  end if;

  update players set current_stack = current_stack + p_amount
  where id = p_player_id
  returning * into v_player;

  insert into transactions (room_id, player_id, type, amount)
  values (p_room_id, p_player_id, 'adjustment', p_amount);

  return v_player;
end;
$$;

create or replace function add_rebuy(
  p_room_id uuid, p_host_token uuid, p_player_id uuid,
  p_amount int, p_type text default 'rebuy'
)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room   rooms;
  v_player players;
begin
  if p_type not in ('rebuy', 'addon') then
    raise exception 'Invalid type';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if not _check_host(p_room_id, p_host_token) then
    raise exception 'Not authorized';
  end if;

  select * into v_room from rooms where id = p_room_id;
  if not found or v_room.status = 'finished' then
    raise exception 'Room is not active';
  end if;

  select * into v_player from players where id = p_player_id and room_id = p_room_id;
  if not found then
    raise exception 'Player not found';
  end if;

  update players set current_stack = current_stack + p_amount
  where id = p_player_id
  returning * into v_player;

  insert into transactions (room_id, player_id, type, amount)
  values (p_room_id, p_player_id, p_type, p_amount);

  return v_player;
end;
$$;

-- ============================================================
-- start_game: переводит комнату из 'lobby' в 'active', назначает
-- первого дилера (по месту за столом) и начинает первую раздачу.
-- ============================================================

create or replace function start_game(p_room_id uuid, p_host_token uuid)
returns rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room   rooms;
  v_count  int;
  v_dealer uuid;
begin
  if not _check_host(p_room_id, p_host_token) then
    raise exception 'Not authorized';
  end if;

  select * into v_room from rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'Game already started';
  end if;

  select count(*) into v_count from players where room_id = p_room_id and status = 'active';
  if v_count < 2 then
    raise exception 'Need at least 2 players to start';
  end if;

  select id into v_dealer from players
  where room_id = p_room_id and status = 'active'
  order by seat_index asc
  limit 1;

  update rooms set status = 'active', dealer_player_id = v_dealer, hand_number = 1
  where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

grant execute on function start_game(uuid, uuid) to anon;

-- ============================================================
-- next_hand: двигает дилер-баттон к следующему активному месту по
-- кругу и увеличивает номер раздачи. Малый/большой блайнд считаются
-- на клиенте от позиции дилера — отдельно не хранятся.
-- ============================================================

create or replace function next_hand(p_room_id uuid, p_host_token uuid)
returns rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room         rooms;
  v_current_seat int;
  v_next         uuid;
begin
  if not _check_host(p_room_id, p_host_token) then
    raise exception 'Not authorized';
  end if;

  select * into v_room from rooms where id = p_room_id;
  if not found or v_room.status <> 'active' then
    raise exception 'Game is not active';
  end if;

  select seat_index into v_current_seat from players where id = v_room.dealer_player_id;

  select id into v_next from players
  where room_id = p_room_id and status = 'active' and seat_index > coalesce(v_current_seat, -1)
  order by seat_index asc
  limit 1;

  if v_next is null then
    select id into v_next from players
    where room_id = p_room_id and status = 'active'
    order by seat_index asc
    limit 1;
  end if;

  if v_next is null then
    raise exception 'No active players';
  end if;

  update rooms set dealer_player_id = v_next, hand_number = hand_number + 1
  where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

grant execute on function next_hand(uuid, uuid) to anon;

-- ============================================================
-- set_blinds: хост меняет размеры блайндов в любой момент.
-- ============================================================

create or replace function set_blinds(p_room_id uuid, p_host_token uuid, p_small_blind int, p_big_blind int)
returns rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms;
begin
  if not _check_host(p_room_id, p_host_token) then
    raise exception 'Not authorized';
  end if;
  if p_small_blind is null or p_small_blind <= 0 or p_big_blind is null or p_big_blind <= p_small_blind then
    raise exception 'Invalid blind values';
  end if;

  update rooms set small_blind = p_small_blind, big_blind = p_big_blind
  where id = p_room_id
  returning * into v_room;

  if not found then
    raise exception 'Room not found';
  end if;

  return v_room;
end;
$$;

grant execute on function set_blinds(uuid, uuid, int, int) to anon;
