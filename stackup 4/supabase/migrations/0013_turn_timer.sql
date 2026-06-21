-- StackUp: настоящий таймер хода с авто-действием по истечении времени.
--
-- Архитектура: своего бэкенда с крон-джобами тут нет (Supabase RPC —
-- это просто функции, вызываемые по запросу), поэтому таймаут
-- обрабатывается так: любой подключённый клиент (хост или игрок,
-- неважно чей) раз в пару секунд тихо вызывает check_timeout(room_id).
-- Если дедлайн ещё не наступил — функция мгновенно завершается без
-- побочных эффектов. Если наступил — атомарно «забирает» право его
-- обработать (через UPDATE ... WHERE turn_deadline < now() ... RETURNING,
-- так что даже если несколько клиентов вызовут это одновременно, сработает
-- только один) и автоматически делает Check (если нечего уравнивать) или
-- Fold за игрока, который не успел ответить.
--
-- Чтобы не дублировать сложную логику смены хода/завершения круга торгов
-- между «игрок нажал кнопку» и «время вышло», основная логика
-- player_action вынесена в общий внутренний _apply_action — сам
-- player_action теперь просто проверяет токен/ход и делегирует туда же.

alter table rooms add column if not exists turn_deadline timestamptz;

-- ============================================================
-- _begin_hand: то же самое, что в 0006, плюс простановка дедлайна хода
-- (25 секунд на ответ) везде, где назначается turn_player_id.
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
    update rooms set pot = 0, current_bet = 0, turn_player_id = null, turn_deadline = null,
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

  select count(*) into v_active_count from players
  where room_id = p_room_id and status = 'active' and hand_state = 'active';

  if v_active_count <= 1 then
    update rooms set turn_player_id = null, turn_deadline = null, hand_stage = 'awaiting_winner' where id = p_room_id;
  else
    update rooms set turn_player_id = v_first.id, turn_deadline = now() + interval '25 seconds', hand_stage = 'betting'
    where id = p_room_id;
  end if;
end;
$$;

-- ============================================================
-- _apply_action: вынесенное ядро player_action — без проверки токена,
-- только сама игровая логика (доступна и player_action, и check_timeout).
-- ============================================================

create or replace function _apply_action(
  p_room_id uuid,
  p_player_id uuid,
  p_action text,
  p_amount int default null
)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room         rooms;
  v_player       players;
  v_call_amt     int;
  v_delta        int;
  v_next         players;
  v_remaining    int;
  v_active_count int;
  v_winner       players;
begin
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

    update rooms set pot = 0, current_bet = 0, turn_player_id = null, turn_deadline = null,
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
    update rooms set turn_player_id = null, turn_deadline = null, hand_stage = 'awaiting_winner' where id = p_room_id;
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
      update rooms set turn_player_id = null, turn_deadline = null, hand_stage = 'awaiting_winner' where id = p_room_id;
    else
      update rooms set turn_player_id = v_next.id, turn_deadline = now() + interval '25 seconds'
      where id = p_room_id;
    end if;
  end if;

  select * into v_player from players where id = p_player_id;
  return v_player;
end;
$$;

-- ============================================================
-- player_action: теперь тонкая обёртка — проверяет токен и сразу же
-- собственной проверкой хода внутри _apply_action, делегирует туда же.
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
begin
  if not _check_player(p_player_id, p_player_token) then
    raise exception 'Not authorized';
  end if;
  return _apply_action(p_room_id, p_player_id, p_action, p_amount);
end;
$$;

grant execute on function player_action(uuid, uuid, uuid, text, int) to anon;

-- ============================================================
-- check_timeout: вызывается периодически с клиента (любого — не только
-- того, чей ход), чтобы заметить истёкшее время хода. Атомарно
-- забирает право обработать таймаут через UPDATE ... RETURNING, поэтому
-- безопасно вызывать одновременно с нескольких устройств — сработает
-- только один раз. Если нечего уравнивать — авто-Check, иначе авто-Fold.
-- ============================================================

create or replace function check_timeout(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room     rooms;
  v_call_amt int;
  v_action   text;
begin
  update rooms set turn_deadline = null
  where id = p_room_id
    and status = 'active'
    and hand_stage = 'betting'
    and turn_deadline is not null
    and turn_deadline < now()
  returning * into v_room;

  if not found then
    return;
  end if;

  select (v_room.current_bet - round_bet) into v_call_amt from players where id = v_room.turn_player_id;
  v_action := case when coalesce(v_call_amt, 0) <= 0 then 'check' else 'fold' end;

  perform _apply_action(p_room_id, v_room.turn_player_id, v_action, null);
end;
$$;

grant execute on function check_timeout(uuid) to anon;
