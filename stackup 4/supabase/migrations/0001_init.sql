-- StackUp: схема базы данных и бизнес-логика
-- Применить через Supabase Dashboard → SQL Editor, либо `supabase db push`.

create extension if not exists pgcrypto;

-- ============================================================
-- ТАБЛИЦЫ
-- ============================================================

create table rooms (
  id             uuid primary key default gen_random_uuid(),
  name           text,
  starting_stack integer not null check (starting_stack > 0),
  max_players    integer not null default 8 check (max_players between 2 and 50),
  status         text not null default 'active' check (status in ('active', 'finished')),
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);

-- host_token живёт в отдельной таблице, чтобы его можно было держать
-- полностью закрытым от anon (включая Realtime), не ограничивая при этом
-- чтение самой комнаты.
create table room_hosts (
  room_id    uuid primary key references rooms(id) on delete cascade,
  host_token uuid not null default gen_random_uuid()
);

create table players (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references rooms(id) on delete cascade,
  name           text not null check (char_length(trim(name)) > 0),
  current_stack  integer not null default 0 check (current_stack >= 0),
  joined_at      timestamptz not null default now()
);

create table transactions (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  type        text not null check (type in ('buyin', 'rebuy', 'addon', 'adjustment')),
  amount      integer not null,
  created_at  timestamptz not null default now()
);

create index idx_players_room on players(room_id);
create index idx_transactions_room on transactions(room_id);
create index idx_transactions_player on transactions(player_id);

-- ============================================================
-- ПРЕДСТАВЛЕНИЕ ДЛЯ ИТОГОВ
-- ============================================================

create or replace view player_results as
select
  p.id as player_id,
  p.room_id,
  p.name,
  p.current_stack,
  coalesce(sum(t.amount) filter (where t.type in ('buyin', 'rebuy', 'addon')), 0) as total_buyin,
  p.current_stack - coalesce(sum(t.amount) filter (where t.type in ('buyin', 'rebuy', 'addon')), 0) as result
from players p
left join transactions t on t.player_id = p.id
group by p.id, p.room_id, p.name, p.current_stack;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table rooms enable row level security;
alter table room_hosts enable row level security;
alter table players enable row level security;
alter table transactions enable row level security;

-- rooms и players/transactions можно читать всем — комната и так защищена
-- непредсказуемым UUID в ссылке/QR-коде, секретов в этих таблицах нет.
create policy "rooms_select_all" on rooms for select using (true);
create policy "players_select_all" on players for select using (true);
create policy "transactions_select_all" on transactions for select using (true);

-- На room_hosts намеренно НЕТ ни одной policy → anon не может прочитать
-- host_token никаким способом (ни через select, ни через Realtime).

-- Прямые insert/update/delete запрещены всем, кроме функций ниже
-- (они выполняются с правами владельца — SECURITY DEFINER).
revoke insert, update, delete on rooms, players, transactions, room_hosts from anon, authenticated;

grant select on player_results to anon, authenticated;

-- ============================================================
-- RPC-ФУНКЦИИ
-- ============================================================

-- Создать комнату. Единственный момент, когда host_token возвращается клиенту.
create or replace function create_room(p_name text, p_starting_stack int, p_max_players int)
returns table (
  id uuid, host_token uuid, name text, starting_stack int,
  max_players int, status text, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room  rooms;
  v_token uuid;
begin
  if p_starting_stack is null or p_starting_stack <= 0 then
    raise exception 'starting_stack must be positive';
  end if;
  if p_max_players is null or p_max_players < 2 or p_max_players > 50 then
    raise exception 'max_players must be between 2 and 50';
  end if;

  insert into rooms (name, starting_stack, max_players)
  values (nullif(trim(p_name), ''), p_starting_stack, p_max_players)
  returning * into v_room;

  insert into room_hosts (room_id) values (v_room.id)
  returning room_hosts.host_token into v_token;

  return query
    select v_room.id, v_token, v_room.name, v_room.starting_stack,
           v_room.max_players, v_room.status, v_room.created_at;
end;
$$;

grant execute on function create_room(text, int, int) to anon;

-- Игрок присоединяется к комнате по её id (host_token не нужен).
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
begin
  select * into v_room from rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;
  if v_room.status <> 'active' then
    raise exception 'Room is no longer active';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Name is required';
  end if;

  select count(*) into v_count from players where room_id = p_room_id;
  if v_count >= v_room.max_players then
    raise exception 'Room is full';
  end if;

  insert into players (room_id, name, current_stack)
  values (p_room_id, trim(p_name), v_room.starting_stack)
  returning * into v_player;

  insert into transactions (room_id, player_id, type, amount)
  values (p_room_id, v_player.id, 'buyin', v_room.starting_stack);

  return v_player;
end;
$$;

grant execute on function join_room(uuid, text) to anon;

-- Внутренний хелпер: проверка host_token.
create or replace function _check_host(p_room_id uuid, p_host_token uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from room_hosts
    where room_id = p_room_id and host_token = p_host_token
  );
$$;

-- Организатор вручную меняет стек игрока (дельта может быть отрицательной).
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
  if not found or v_room.status <> 'active' then
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

grant execute on function adjust_stack(uuid, uuid, uuid, int) to anon;

-- Rebuy / Add-on: увеличивает и стек, и общую сумму buy-in игрока.
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
  if not found or v_room.status <> 'active' then
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

grant execute on function add_rebuy(uuid, uuid, uuid, int, text) to anon;

-- Завершить игру: после этого изменения стеков больше недоступны.
create or replace function finish_game(p_room_id uuid, p_host_token uuid)
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

  update rooms set status = 'finished', finished_at = now()
  where id = p_room_id
  returning * into v_room;

  if not found then
    raise exception 'Room not found';
  end if;

  return v_room;
end;
$$;

grant execute on function finish_game(uuid, uuid) to anon;

-- ============================================================
-- REALTIME
-- ============================================================
-- room_hosts и transactions намеренно НЕ публикуются: клиентам достаточно
-- live-обновлений rooms (статус) и players (стеки).
alter publication supabase_realtime add table rooms, players;
