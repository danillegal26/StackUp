-- StackUp: Этап 2б — экран выбора победителя.
-- Раньше при завершении торгов с 2+ игроками банк просто «висел» на столе,
-- и хост распределял его вручную через «Стек». Теперь — отдельная кнопка
-- «Завершить раздачу» открывает выбор победителя (один или несколько,
-- банк делится поровну), и RPC сама раздаёт фишки и сбрасывает раздачу.

create or replace function award_pot(p_room_id uuid, p_host_token uuid, p_winner_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room        rooms;
  v_n           int;
  v_base        int;
  v_remainder   int;
  v_idx         int := 0;
  v_share       int;
  v_winner      players;
  v_valid_count int;
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

  v_n := coalesce(array_length(p_winner_ids, 1), 0);
  if v_n = 0 then
    raise exception 'Select at least one winner';
  end if;

  -- защита от опечаток/чужих id: каждый выбранный победитель должен
  -- реально быть за этим столом и не сбросить карты в этой раздаче
  select count(*) into v_valid_count from players
  where id = any(p_winner_ids) and room_id = p_room_id and status = 'active' and hand_state <> 'folded';
  if v_valid_count <> v_n then
    raise exception 'Invalid winner selection';
  end if;

  v_base := v_room.pot / v_n;
  v_remainder := v_room.pot % v_n;

  -- если банк не делится поровну без остатка — «лишние» фишки достаются
  -- по одной победителям по порядку мест за столом (детерминированно,
  -- чтобы не терять и не придумывать фишки из ниоткуда)
  for v_winner in
    select * from players where id = any(p_winner_ids) and room_id = p_room_id order by seat_index asc
  loop
    v_share := v_base + case when v_idx < v_remainder then 1 else 0 end;
    update players set current_stack = current_stack + v_share where id = v_winner.id;
    insert into transactions (room_id, player_id, type, amount) values (p_room_id, v_winner.id, 'adjustment', v_share);
    v_idx := v_idx + 1;
  end loop;

  update rooms set pot = 0, current_bet = 0, turn_player_id = null, last_aggressor_id = null, hand_stage = 'idle'
  where id = p_room_id;
end;
$$;

grant execute on function award_pot(uuid, uuid, uuid[]) to anon;
