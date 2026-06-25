-- StackUp: Этап 2г — сайд-поты.
-- Раньше при all-in за меньший стек один общий банк мог некорректно
-- достаться тому, кто на самом деле не имел права на «лишние» фишки
-- сверх своего all-in. Теперь банк при необходимости режется на слои
-- (основной + один или несколько побочных), и для каждого слоя — свой
-- список тех, кто имеет право его выиграть.

-- ============================================================
-- _compute_side_pots: чистая функция, без побочных эффектов — считает
-- разбивку банка по текущим round_bet/hand_state игроков комнаты.
-- Тот же алгоритм продублирован на клиенте (src/lib/sidePots.ts) для
-- отображения хосту, но деньгами распоряжается только эта, серверная,
-- версия — клиентский расчёт лишь подсказка для интерфейса.
-- ============================================================

create or replace function _compute_side_pots(p_room_id uuid)
returns table(pot_index int, amount int, eligible_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level    int;
  v_prev     int := 0;
  v_idx      int := 0;
  v_amount   int;
  v_eligible uuid[];
begin
  for v_level in
    select distinct round_bet from players
    where room_id = p_room_id and status = 'active' and round_bet > 0
    order by round_bet asc
  loop
    select count(*) * (v_level - v_prev) into v_amount
    from players
    where room_id = p_room_id and status = 'active' and round_bet >= v_level;

    select coalesce(array_agg(id), array[]::uuid[]) into v_eligible
    from players
    where room_id = p_room_id and status = 'active' and round_bet >= v_level and hand_state <> 'folded';

    if v_amount > 0 and coalesce(array_length(v_eligible, 1), 0) > 0 then
      pot_index := v_idx;
      amount := v_amount;
      eligible_ids := v_eligible;
      return next;
      v_idx := v_idx + 1;
    end if;

    v_prev := v_level;
  end loop;
end;
$$;

-- ============================================================
-- award_pots: новая версия выбора победителя — по одному списку
-- победителей на каждый рассчитанный банк (основной/побочные), в том же
-- порядке, в котором их вернула _compute_side_pots. p_pot_winners —
-- jsonb-массив массивов id игроков, например [["id1","id2"], ["id3"]].
-- award_pot (один общий банк, из 0007/0008) оставлен как есть для
-- обратной совместимости, но интерфейс теперь всегда вызывает эту.
-- ============================================================

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

    -- защита: выбранный победитель обязан реально иметь право на ИМЕННО этот банк
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

  update rooms set pot = 0, current_bet = 0, turn_player_id = null, last_aggressor_id = null, hand_stage = 'idle',
    last_hand_winner_ids = v_all_winner_ids, last_hand_pot = v_total_pot, last_hand_number = v_room.hand_number
  where id = p_room_id;
end;
$$;

grant execute on function award_pots(uuid, uuid, jsonb) to anon;
