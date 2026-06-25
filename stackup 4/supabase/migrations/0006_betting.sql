-- StackUp: Этап 2а — реальные ставки.
-- Игроки сами делают ходы (Check/Call/Bet/Raise/Fold/All-In), система сама
-- считает банк, текущую ставку и сумму для колла. Блайнды списываются
-- автоматически в начале каждой раздачи. Сайд-поты и экран выбора
-- победителя — следующий шаг; пока раздача доходит до вскрытия с 2+
-- игроками без фолда, банк просто остаётся на столе и хост по-прежнему
-- распределяет его вручную через «Стек», как раньше.

-- ============================================================
-- player_tokens: секретный токен для каждого игрока, по аналогии с
-- room_hosts — отдельная таблица БЕЗ select-политики, чтобы токен не
-- утёк через обычный select/realtime на players. Только через RPC.
-- ============================================================

create table if not exists player_tokens (
  player_id uuid primary key references players(id) on delete cascade,
  token uuid not null default gen_random_uuid()
);

alter table player_tokens enable row level security;

create or replace function _check_player(p_player_id uuid, p_player_token uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from player_tokens
    where player_id = p_player_id and token = p_player_token
  );
$$;

-- ============================================================
-- НОВЫЕ КОЛОНКИ
-- ============================================================

alter table players add column if not exists round_bet integer not null default 0;
alter table players add column if not exists hand_state text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'players_hand_state_check'
  ) then
    alter table players add constraint players_hand_state_check
      check (hand_state in ('active', 'folded', 'all_in'));
  end if;
end $$;

alter table rooms add column if not exists pot integer not null default 0;
alter table rooms add column if not exists current_bet integer not null default 0;
alter table rooms add column if not exists turn_player_id uuid references players(id) on delete set null;
alter table rooms add column if not exists last_aggressor_id uuid references players(id) on delete set null;
alter table rooms add column if not exists hand_stage text not null default 'idle';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rooms_hand_stage_check'
  ) then
    alter table rooms add constraint rooms_hand_stage_check
      check (hand_stage in ('idle', 'betting', 'awaiting_winner'));
  end if;
end $$;

-- ============================================================
-- join_room / host_join_room: возвращаемый тип меняется (нужен ещё и
-- player_token), Postgres считает это другой функцией — дропаем старые
-- сигнатуры. Сам токен выдаётся один раз при входе и хранится в
-- player_tokens; полную карточку игрока клиент получает как раньше —
-- через realtime-подписку на players (она уже есть).
-- ============================================================

drop function if exists join_room(uuid, text, text);
drop function if exists host_join_room(uuid, uuid, text, text);

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

grant execute on function join_room(uuid, text, text) to anon;

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

grant execute on function host_join_room(uuid, uuid, text, text) to anon;

-- ============================================================
-- _begin_hand: внутренний помощник (вызывается из start_game и next_hand,
-- уже прошедших проверку хоста) — сбрасывает состояние раздачи и постит
-- блайнды. Для героз-апа (ровно 2 активных игрока) используется реальное
-- покерное правило «дилер = малый блайнд, ходит первым» — это отличается
-- от упрощённой схемы для 3+ игроков, но для героз-апа блайнды реально
-- влияют на то, кто сколько платит, поэтому здесь сделано по правилам.
-- ============================================================

create or replace function _begin_hand(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room        rooms;
  v_n           int;
  v_dealer_seat int;
  v_sb          players;
  v_bb          players;
  v_first       players;
  v_sb_amt      int;
  v_bb_amt      int;
  v_active_count int;
begin
  select * into v_room from rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;

  update players set round_bet = 0, hand_state = 'active'
  where room_id = p_room_id and status = 'active';

  select count(*) into v_n from players where room_id = p_room_id and status = 'active';
  if v_n < 2 then
    update rooms set pot = 0, current_bet = 0, turn_player_id = null,
      last_aggressor_id = null, hand_stage = 'idle'
    where id = p_room_id;
    return;
  end if;

  if v_n = 2 then
    select * into v_sb from players where id = v_room.dealer_player_id;
    select * into v_bb from players
    where room_id = p_room_id and status = 'active' and id <> v_room.dealer_player_id
    limit 1;
    v_first := v_sb;
  else
    select seat_index into v_dealer_seat from players where id = v_room.dealer_player_id;

    select * into v_sb from players
    where room_id = p_room_id and status = 'active' and seat_index > coalesce(v_dealer_seat, -1)
    order by seat_index asc limit 1;
    if not found then
      select * into v_sb from players
      where room_id = p_room_id and status = 'active' order by seat_index asc limit 1;
    end if;

    select * into v_bb from players
    where room_id = p_room_id and status = 'active' and seat_index > v_sb.seat_index
    order by seat_index asc limit 1;
    if not found then
      select * into v_bb from players
      where room_id = p_room_id and status = 'active' order by seat_index asc limit 1;
    end if;

    select * into v_first from players
    where room_id = p_room_id and status = 'active' and seat_index > v_bb.seat_index
    order by seat_index asc limit 1;
    if not found then
      select * into v_first from players
      where room_id = p_room_id and status = 'active' order by seat_index asc limit 1;
    end if;
  end if;

  v_sb_amt := least(coalesce(v_room.small_blind, 0), v_sb.current_stack);
  v_bb_amt := least(coalesce(v_room.big_blind, 0), v_bb.current_stack);

  update players set
    current_stack = current_stack - v_sb_amt,
    round_bet = v_sb_amt,
    hand_state = case when v_sb_amt > 0 and v_sb_amt = v_sb.current_stack then 'all_in' else 'active' end
  where id = v_sb.id;

  update players set
    current_stack = current_stack - v_bb_amt,
    round_bet = v_bb_amt,
    hand_state = case when v_bb_amt > 0 and v_bb_amt = v_bb.current_stack then 'all_in' else 'active' end
  where id = v_bb.id;

  update rooms set
    pot = v_sb_amt + v_bb_amt,
    current_bet = v_bb_amt,
    last_aggressor_id = v_bb.id
  where id = p_room_id;

  -- если блайнд оказался больше стека (короткий стек) — игрок, который
  -- должен был ходить первым, мог сам уйти в all-in при постановке блайнда.
  -- Если после этого действовать в принципе некому — сразу ждём решения
  -- хоста, а не зависаем в стадии «betting» без живого хода.
  select count(*) into v_active_count from players
  where room_id = p_room_id and status = 'active' and hand_state = 'active';

  if v_active_count <= 1 then
    update rooms set turn_player_id = null, hand_stage = 'awaiting_winner' where id = p_room_id;
  else
    update rooms set turn_player_id = v_first.id, hand_stage = 'betting' where id = p_room_id;
  end if;
end;
$$;

-- ============================================================
-- start_game / next_hand: теперь ещё и сразу постят блайнды и открывают
-- круг торгов через _begin_hand (раньше только переключали статус/дилера).
-- next_hand дополнительно не даёт уйти на новую раздачу, пока в банке
-- остались нераспределённые фишки прошлой раздачи — иначе они бы просто
-- пропали при сбросе банка.
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

  perform _begin_hand(p_room_id);

  select * into v_room from rooms where id = p_room_id;
  return v_room;
end;
$$;

grant execute on function start_game(uuid, uuid) to anon;

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

  if v_room.hand_stage <> 'idle' and v_room.pot > 0 then
    raise exception 'Распределите банк текущей раздачи (кнопка «Стек» у победителя), потом начинайте следующую';
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

  perform _begin_hand(p_room_id);

  select * into v_room from rooms where id = p_room_id;
  return v_room;
end;
$$;

grant execute on function next_hand(uuid, uuid) to anon;

-- ============================================================
-- player_action: единая точка для Check/Call/Bet/Raise/Fold/All-In.
-- Любой игрок действует только за себя (проверяется player_token) и
-- только в свой ход. p_amount для bet/raise — это НОВАЯ ОБЩАЯ ставка
-- игрока в этом круге торгов (а не «на сколько добавить»), как принято
-- в покерных интерфейсах («raise to 800», а не «+400»).
-- ============================================================

create or replace function player_action(
  p_room_id uuid,
  p_player_id uuid,
  p_player_token uuid,
  p_action text,
  p_amount int default null
)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room        rooms;
  v_player      players;
  v_call_amt    int;
  v_delta       int;
  v_next        players;
  v_remaining   int;
  v_active_count int;
  v_winner      players;
begin
  if not _check_player(p_player_id, p_player_token) then
    raise exception 'Not authorized';
  end if;
  if p_action not in ('check', 'call', 'bet', 'raise', 'fold', 'all_in') then
    raise exception 'Invalid action';
  end if;

  select * into v_room from rooms where id = p_room_id;
  if not found or v_room.status <> 'active' or v_room.hand_stage <> 'betting' then
    raise exception 'No active betting round';
  end if;
  if v_room.turn_player_id <> p_player_id then
    raise exception 'Not your turn';
  end if;

  select * into v_player from players where id = p_player_id and room_id = p_room_id;
  if not found or v_player.status <> 'active' or v_player.hand_state <> 'active' then
    raise exception 'Player cannot act';
  end if;

  v_call_amt := v_room.current_bet - v_player.round_bet;

  if p_action = 'fold' then
    update players set hand_state = 'folded' where id = p_player_id;

  elsif p_action = 'check' then
    if v_call_amt > 0 then
      raise exception 'Cannot check, must call or fold';
    end if;

  elsif p_action = 'call' then
    if v_call_amt <= 0 then
      raise exception 'Nothing to call';
    end if;
    v_delta := least(v_call_amt, v_player.current_stack);
    update players set
      current_stack = current_stack - v_delta,
      round_bet = round_bet + v_delta,
      hand_state = case when v_delta = v_player.current_stack then 'all_in' else 'active' end
    where id = p_player_id;
    update rooms set pot = pot + v_delta where id = p_room_id;

  elsif p_action in ('bet', 'raise') then
    if p_amount is null or p_amount <= v_room.current_bet then
      raise exception 'Amount must be greater than current bet';
    end if;
    v_delta := p_amount - v_player.round_bet;
    if v_delta <= 0 or v_delta > v_player.current_stack then
      raise exception 'Invalid bet amount';
    end if;
    update players set
      current_stack = current_stack - v_delta,
      round_bet = p_amount,
      hand_state = case when v_delta = v_player.current_stack then 'all_in' else 'active' end
    where id = p_player_id;
    update rooms set pot = pot + v_delta, current_bet = p_amount, last_aggressor_id = p_player_id
    where id = p_room_id;

  elsif p_action = 'all_in' then
    v_delta := v_player.current_stack;
    if v_delta <= 0 then
      raise exception 'No chips left';
    end if;
    update players set
      current_stack = 0,
      round_bet = round_bet + v_delta,
      hand_state = 'all_in'
    where id = p_player_id;
    update rooms set pot = pot + v_delta where id = p_room_id;
    if (v_player.round_bet + v_delta) > v_room.current_bet then
      update rooms set current_bet = v_player.round_bet + v_delta, last_aggressor_id = p_player_id
      where id = p_room_id;
    end if;
  end if;

  -- если после хода в раздаче остался один игрок — банк сразу его
  select count(*) into v_remaining from players
  where room_id = p_room_id and status = 'active' and hand_state <> 'folded';

  if v_remaining = 1 then
    select * into v_winner from players
    where room_id = p_room_id and status = 'active' and hand_state <> 'folded'
    limit 1;

    select * into v_room from rooms where id = p_room_id;

    update players set current_stack = current_stack + v_room.pot where id = v_winner.id;

    insert into transactions (room_id, player_id, type, amount)
    values (p_room_id, v_winner.id, 'adjustment', v_room.pot);

    update rooms set pot = 0, current_bet = 0, turn_player_id = null,
      last_aggressor_id = null, hand_stage = 'idle'
    where id = p_room_id;

    select * into v_player from players where id = p_player_id;
    return v_player;
  end if;

  select * into v_room from rooms where id = p_room_id;

  -- сколько игроков ещё реально могут ходить (не сфолдили и не all-in).
  -- Если остался максимум один такой игрок — круг торгов закрыт: либо
  -- действовать больше некому, либо единственный оставшийся уже принял
  -- решение этим самым ходом и спрашивать его снова не нужно (иначе
  -- можно зациклиться, когда все остальные ушли в all-in).
  select count(*) into v_active_count from players
  where room_id = p_room_id and status = 'active' and hand_state = 'active';

  if v_active_count <= 1 then
    update rooms set turn_player_id = null, hand_stage = 'awaiting_winner' where id = p_room_id;
  else
    select * into v_next from players
    where room_id = p_room_id and status = 'active' and hand_state = 'active'
      and seat_index > (select seat_index from players where id = p_player_id)
    order by seat_index asc limit 1;
    if not found then
      select * into v_next from players
      where room_id = p_room_id and status = 'active' and hand_state = 'active'
      order by seat_index asc limit 1;
    end if;

    if v_next.id = v_room.last_aggressor_id then
      -- ход вернулся к тому, кто ставил последним — круг торгов закрыт
      update rooms set turn_player_id = null, hand_stage = 'awaiting_winner' where id = p_room_id;
    else
      update rooms set turn_player_id = v_next.id where id = p_room_id;
    end if;
  end if;

  select * into v_player from players where id = p_player_id;
  return v_player;
end;
$$;

grant execute on function player_action(uuid, uuid, uuid, text, int) to anon;
