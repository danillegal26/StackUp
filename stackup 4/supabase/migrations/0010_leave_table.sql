-- StackUp: «Покинуть стол» — игрок уходит сам, без участия организатора
-- (как кнопка LEAVE TABLE в макете). Раньше это умел делать только хост
-- через «✕» у карточки игрока.
--
-- Важное ограничение: уйти можно только когда в раздаче нет активного
-- круга торгов (hand_stage = 'idle') — то есть между раздачами, а не
-- посреди одной. Это намеренно: _compute_side_pots и вся раздача банка
-- фильтруют игроков по status = 'active', и если бы игрок с уже
-- внесёнными в банк фишками (round_bet > 0) мог сменить статус на
-- 'left' посреди раздачи, его фишки могли бы пропасть из расчёта банка
-- или его законная доля — потеряться. Проще и безопаснее не пускать
-- именно в этот момент, чем городить отдельную логику переноса ставки.

create or replace function leave_table(p_room_id uuid, p_player_id uuid, p_player_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room   rooms;
  v_player players;
begin
  if not _check_player(p_player_id, p_player_token) then
    raise exception 'Not authorized';
  end if;

  select * into v_room from rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;

  select * into v_player from players where id = p_player_id and room_id = p_room_id;
  if not found or v_player.status <> 'active' then
    raise exception 'Player already left';
  end if;

  if v_room.status = 'active' and v_room.hand_stage <> 'idle' then
    raise exception 'Дождитесь завершения текущей раздачи, чтобы покинуть стол';
  end if;

  update players set status = 'left' where id = p_player_id;
end;
$$;

grant execute on function leave_table(uuid, uuid, uuid) to anon;
