-- StackUp: история раздач. last_hand_* на rooms хранит только САМЫЙ
-- последний результат (нужен для баннера победителя) и перезаписывается
-- каждый раз — для полноценного списка прошлых раздач нужна отдельная
-- таблица, которая не перетирается.

create table if not exists hand_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  hand_number integer not null,
  pot integer not null,
  winner_ids uuid[] not null,
  created_at timestamptz not null default now()
);

create index if not exists hand_history_room_id_idx on hand_history(room_id, hand_number);

alter table hand_history enable row level security;

-- Не секрет (как и players/transactions) — комната и так защищена
-- непредсказуемым UUID в ссылке/QR-коде.
create policy "hand_history_select_all" on hand_history for select using (true);

-- ============================================================
-- player_action / award_pots: то же самое, что в 0008/0009, плюс запись
-- строки в hand_history рядом с обновлением last_hand_*.
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

    insert into hand_history (room_id, hand_number, pot, winner_ids)
    values (p_room_id, v_room.hand_number, v_room.pot, array[v_winner.id]);

    update rooms set pot = 0, current_bet = 0, turn_player_id = null,
      last_aggressor_id = null, hand_stage = 'idle',
      last_hand_winner_ids = array[v_winner.id], last_hand_pot = v_room.pot, last_hand_number = v_room.hand_number
    where id = p_room_id;

    select * into v_player from players where id = p_player_id;
    return v_player;
  end if;

  select * into v_room from rooms where id = p_room_id;

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

create or replace function award_pots(p_room_id uuid, p_host_token uuid, p_pot_winners jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room            rooms;
  v_pot             record;
  v_idx             int := 0;
  v_winner_ids      uuid[];
  v_n               int;
  v_base            int;
  v_remainder       int;
  v_widx            int;
  v_winner_id       uuid;
  v_share           int;
  v_total_pot       int := 0;
  v_all_winner_ids  uuid[] := array[]::uuid[];
begin
  if not _check_host(p_room_id, p_host_token) then
    raise exception 'Not authorized';
  end if;

  select * into v_room from rooms where id = p_room_id;
  if not found or v_room.status <> 'active' then
    raise exception 'Room is not active';
  end if;
  if v_room.hand_stage <> 'awaiting_winner' or v_room.pot <= 0 then
    raise exception 'No pot to award right now';
  end if;

  for v_pot in select * from _compute_side_pots(p_room_id) order by pot_index asc loop
    select coalesce(array(select jsonb_array_elements_text(p_pot_winners -> v_idx)), array[]::text[])::uuid[]
      into v_winner_ids;

    v_n := coalesce(array_length(v_winner_ids, 1), 0);
    if v_n = 0 then
      raise exception 'Select at least one winner for every pot';
    end if;

    if exists (select 1 from unnest(v_winner_ids) wid where not (wid = any(v_pot.eligible_ids))) then
      raise exception 'Invalid winner selection for a side pot';
    end if;

    v_base := v_pot.amount / v_n;
    v_remainder := v_pot.amount % v_n;
    v_widx := 0;

    for v_winner_id in
      select players.id from players where players.id = any(v_winner_ids) order by players.seat_index asc
    loop
      v_share := v_base + case when v_widx < v_remainder then 1 else 0 end;
      update players set current_stack = current_stack + v_share where id = v_winner_id;
      insert into transactions (room_id, player_id, type, amount) values (p_room_id, v_winner_id, 'adjustment', v_share);
      v_widx := v_widx + 1;
    end loop;

    v_total_pot := v_total_pot + v_pot.amount;
    v_all_winner_ids := v_all_winner_ids || v_winner_ids;
    v_idx := v_idx + 1;
  end loop;

  if v_idx = 0 then
    raise exception 'No pots to award';
  end if;

  insert into hand_history (room_id, hand_number, pot, winner_ids)
  values (p_room_id, v_room.hand_number, v_total_pot, v_all_winner_ids);

  update rooms set pot = 0, current_bet = 0, turn_player_id = null, last_aggressor_id = null, hand_stage = 'idle',
    last_hand_winner_ids = v_all_winner_ids, last_hand_pot = v_total_pot, last_hand_number = v_room.hand_number
  where id = p_room_id;
end;
$$;

grant execute on function award_pots(uuid, uuid, jsonb) to anon;
