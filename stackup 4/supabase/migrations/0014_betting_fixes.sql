-- StackUp: исправление реального бага в торгах + Finish Game.
--
-- БАГ (раунд закрывался преждевременно): закрытие круга торгов
-- определялось сравнением «следующий по очереди == тот, кто ставил
-- последним (last_aggressor)». last_aggressor выставлялся уже на этапе
-- постановки блайндов (на BB) — и если дальше никто не рейзил, а просто
-- коллировали по кругу, действие возвращалось ровно к BB, и торги
-- закрывались, даже не дав BB своего «опциона» (шанса чекнуть или
-- зарейзить) — то есть последнему игроку в очереди ход просто не
-- передавался. Это самый частый случай в казуальной игре (все просто
-- коллируют блайнд), поэтому баг был заметен сразу.
--
-- ИСПРАВЛЕНИЕ: вместо сравнения с last_aggressor вводится явный флаг
-- players.has_acted — «сходил ли игрок в этом круге торгов после
-- последней ставки/рейза». Раунд закрывается, когда не осталось ни
-- одного активного игрока, который либо ещё не ходил, либо ещё не
-- уровнял текущую ставку. Любой bet/raise (и all-in, повышающий ставку)
-- сбрасывает has_acted всем остальным ещё живым игрокам — им нужно
-- отреагировать на новую ставку заново, даже если уже ходили раньше в
-- этом же круге.

alter table players add column if not exists has_acted boolean not null default false;

-- ============================================================
-- _begin_hand: то же самое, что в 0013, плюс сброс has_acted в false
-- для всех активных игроков (постановка блайнда — НЕ действие, has_acted
-- у тех, кто их платит, тоже остаётся false).
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

  update players set round_bet = 0, hand_state = 'active', has_acted = false
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
-- _apply_action: та же логика самих действий (fold/check/call/bet/raise/
-- all_in), что в 0013, но определение «закрылся ли круг торгов и кто
-- ходит дальше» переписано на has_acted вместо сравнения с
-- last_aggressor — см. объяснение бага выше.
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
    v_is_raise := true;

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
      v_is_raise := true;
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

  -- сам игрок сходил в этом круге торгов
  update players set has_acted = true where id = p_player_id;

  -- если это была реальная ставка/рейз — все остальные ещё живые игроки
  -- должны отреагировать заново, даже если уже ходили раньше в этом
  -- круге (иначе их прежний has_acted=true преждевременно закроет круг,
  -- не дав им шанса ответить на новую ставку)
  if v_is_raise then
    update players set has_acted = false
    where room_id = p_room_id and status = 'active' and hand_state = 'active' and id <> p_player_id;
  end if;

  select * into v_room from rooms where id = p_room_id;

  -- «нужно действовать» = ещё в раздаче (active), и либо ещё не ходил
  -- в этом круге, либо ставка ещё не дотягивает до текущей максимальной
  select count(*) into v_needs_action from players
  where room_id = p_room_id and status = 'active' and hand_state = 'active'
    and (not has_acted or round_bet < v_room.current_bet);

  if v_needs_action = 0 then
    update rooms set turn_player_id = null, turn_deadline = null, hand_stage = 'awaiting_winner' where id = p_room_id;
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
-- finish_game: вместо ошибки при незавершённой раздаче — возвращаем
-- игрокам их ставки этого круга торгов обратно в стек (раздача
-- отменяется, победитель не объявляется — он и не может быть объявлен
-- автоматически для незаконченной раздачи) и закрываем сессию.
-- ============================================================

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

  select * into v_room from rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;

  if v_room.hand_stage <> 'idle' then
    update players set current_stack = current_stack + round_bet, round_bet = 0
    where room_id = p_room_id and status = 'active' and round_bet > 0;

    update rooms set pot = 0, current_bet = 0, turn_player_id = null, turn_deadline = null,
      last_aggressor_id = null, hand_stage = 'idle'
    where id = p_room_id;
  end if;

  update rooms set status = 'finished', finished_at = now()
  where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

grant execute on function finish_game(uuid, uuid) to anon;
