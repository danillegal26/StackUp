-- StackUp: метка последнего действия игрока (для всплывающих подписей
-- "Чек"/"Колл"/"Рейз"/"Сброс" у места игрока на столе, как в PokerStars/
-- GG Poker).
--
-- Зачем отдельное поле, а не вывести на клиенте из уже имеющихся данных:
-- Fold/Call/Raise/All-in можно было бы определить по изменению
-- hand_state/round_bet между рендерами, но Check — это ДЕЙСТВИЕ БЕЗ
-- ДВИЖЕНИЯ ФИШЕК, его никак не отличить от "просто ничего не
-- произошло" по дельте состояния. Поэтому сервер сам пишет, какое
-- действие было последним — это просто метаданные для UI, на саму
-- логику торгов никак не влияет.

alter table players add column if not exists last_action text;

-- ============================================================
-- _begin_hand: та же логика, что в 0016, плюс сброс last_action в null
-- при старте новой раздачи (старые подписи не должны «протухать»
-- видимыми после смены раздачи).
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

  update players set round_bet = 0, hand_state = 'active', has_acted = false, hand_contributed = 0, last_action = null
  where room_id = p_room_id and status = 'active';

  select count(*) into v_n from players where room_id = p_room_id and status = 'active';
  if v_n < 2 then
    update rooms set pot = 0, current_bet = 0, turn_player_id = null, turn_deadline = null,
      last_aggressor_id = null, hand_stage = 'idle', street = 'preflop'
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
    hand_contributed = v_sb_amt,
    hand_state = case when v_sb_amt > 0 and v_sb_amt = v_sb.current_stack then 'all_in' else 'active' end
  where id = v_sb.id;

  update players set
    current_stack = current_stack - v_bb_amt,
    round_bet = v_bb_amt,
    hand_contributed = v_bb_amt,
    hand_state = case when v_bb_amt > 0 and v_bb_amt = v_bb.current_stack then 'all_in' else 'active' end
  where id = v_bb.id;

  update rooms set
    pot = v_sb_amt + v_bb_amt,
    current_bet = v_bb_amt,
    last_aggressor_id = v_bb.id,
    street = 'preflop'
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
-- _apply_action: та же логика, что в 0016, плюс запись last_action для
-- сходившего игрока (и для того, чей fold завершил раздачу победой по
-- умолчанию).
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
  v_room        rooms;
  v_player      players;
  v_call_amt    int;
  v_delta       int;
  v_next        players;
  v_remaining   int;
  v_needs_action int;
  v_winner      players;
  v_is_raise    boolean := false;
begin
  if p_action not in ('check', 'call', 'bet', 'raise', 'fold', 'all_in') then
    raise exception 'Invalid action';
  end if;

  select * into v_room from rooms where id = p_room_id;
  if not found or v_room.status <> 'active' or v_room.hand_stage <> 'betting' then
    raise exception 'No active betting round';
  end if;
  if v_room.turn_player_id is null or v_room.turn_player_id <> p_player_id then
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
      hand_contributed = hand_contributed + v_delta,
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
      hand_contributed = hand_contributed + v_delta,
      hand_state = case when v_delta = v_player.current_stack then 'all_in' else 'active' end
    where id = p_player_id;
    update rooms set pot = pot + v_delta, current_bet = p_amount, last_aggressor_id = p_player_id
    where id = p_room_id;
    v_is_raise := true;

  elsif p_action = 'all_in' then
    v_delta := v_player.current_stack;
    if v_delta <= 0 then
      raise exception 'No chips left';
    end if;
    update players set
      current_stack = 0,
      round_bet = round_bet + v_delta,
      hand_contributed = hand_contributed + v_delta,
      hand_state = 'all_in'
    where id = p_player_id;
    update rooms set pot = pot + v_delta where id = p_room_id;
    if (v_player.round_bet + v_delta) > v_room.current_bet then
      update rooms set current_bet = v_player.round_bet + v_delta, last_aggressor_id = p_player_id
      where id = p_room_id;
      v_is_raise := true;
    end if;
  end if;

  select count(*) into v_remaining from players
  where room_id = p_room_id and status = 'active' and hand_state <> 'folded';

  if v_remaining = 1 then
    update players set last_action = p_action where id = p_player_id;

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
      last_aggressor_id = null, hand_stage = 'idle', street = 'preflop',
      last_hand_winner_ids = array[v_winner.id], last_hand_pot = v_room.pot, last_hand_number = v_room.hand_number
    where id = p_room_id;

    select * into v_player from players where id = p_player_id;
    return v_player;
  end if;

  update players set has_acted = true, last_action = p_action where id = p_player_id;

  if v_is_raise then
    update players set has_acted = false
    where room_id = p_room_id and status = 'active' and hand_state = 'active' and id <> p_player_id;
  end if;

  select * into v_room from rooms where id = p_room_id;

  select count(*) into v_needs_action from players
  where room_id = p_room_id and status = 'active' and hand_state = 'active'
    and (not has_acted or round_bet < v_room.current_bet);

  if v_needs_action = 0 then
    if v_room.street = 'river' then
      update rooms set turn_player_id = null, turn_deadline = null, hand_stage = 'awaiting_winner' where id = p_room_id;
    else
      -- круг этой улицы закрыт — ждём, пока организатор физически
      -- выложит следующую карту(ы) и нажмёт «Следующая улица»
      update rooms set turn_player_id = null, turn_deadline = null where id = p_room_id;
    end if;
  else
    select * into v_next from players
    where room_id = p_room_id and status = 'active' and hand_state = 'active'
      and (not has_acted or round_bet < v_room.current_bet)
      and seat_index > (select seat_index from players where id = p_player_id)
    order by seat_index asc limit 1;
    if not found then
      select * into v_next from players
      where room_id = p_room_id and status = 'active' and hand_state = 'active'
        and (not has_acted or round_bet < v_room.current_bet)
      order by seat_index asc limit 1;
    end if;

    update rooms set turn_player_id = v_next.id, turn_deadline = now() + interval '25 seconds'
    where id = p_room_id;
  end if;

  select * into v_player from players where id = p_player_id;
  return v_player;
end;
$$;

-- ============================================================
-- next_stage: та же логика, что в 0016, плюс сброс last_action в null
-- для всех живых игроков при переходе на новую улицу (подписи прошлой
-- улицы больше не актуальны).
-- ============================================================

create or replace function next_stage(p_room_id uuid, p_host_token uuid)
returns rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room         rooms;
  v_dealer_seat  int;
  v_next         players;
  v_active_count int;
  v_next_street  text;
begin
  if not _check_host(p_room_id, p_host_token) then
    raise exception 'Not authorized';
  end if;

  select * into v_room from rooms where id = p_room_id;
  if not found or v_room.status <> 'active' then
    raise exception 'Room is not active';
  end if;
  if v_room.hand_stage <> 'betting' or v_room.turn_player_id is not null then
    raise exception 'Current betting round is not finished yet';
  end if;
  if v_room.street = 'river' then
    raise exception 'Already on the last street';
  end if;

  v_next_street := case v_room.street
    when 'preflop' then 'flop'
    when 'flop' then 'turn'
    when 'turn' then 'river'
  end;

  update players set round_bet = 0, has_acted = false, last_action = null
  where room_id = p_room_id and status = 'active' and hand_state in ('active', 'all_in');

  update rooms set street = v_next_street, current_bet = 0 where id = p_room_id;

  select count(*) into v_active_count from players
  where room_id = p_room_id and status = 'active' and hand_state = 'active';

  if v_active_count <= 1 then
    -- никто больше не может ставить на этой улице (все остальные либо
    -- олл-ин, либо сфолдили). Если это уже ривер — дальше ставить
    -- негде, сразу открываем выбор победителя. Если нет — организатор
    -- просто продолжит жать «Следующая улица», физически раздавая
    -- оставшиеся карты, пока не дойдёт до ривера.
    if v_next_street = 'river' then
      update rooms set turn_player_id = null, turn_deadline = null, hand_stage = 'awaiting_winner' where id = p_room_id;
    else
      update rooms set turn_player_id = null, turn_deadline = null where id = p_room_id;
    end if;
  else
    select seat_index into v_dealer_seat from players where id = v_room.dealer_player_id;

    select * into v_next from players
    where room_id = p_room_id and status = 'active' and hand_state = 'active'
      and seat_index > coalesce(v_dealer_seat, -1)
    order by seat_index asc limit 1;
    if not found then
      select * into v_next from players
      where room_id = p_room_id and status = 'active' and hand_state = 'active'
      order by seat_index asc limit 1;
    end if;

    update rooms set turn_player_id = v_next.id, turn_deadline = now() + interval '25 seconds'
    where id = p_room_id;
  end if;

  select * into v_room from rooms where id = p_room_id;
  return v_room;
end;
$$;
