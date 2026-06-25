-- StackUp: защита finish_game от того же риска, что уже закрыт в
-- next_hand — если завершить игру, пока банк текущей раздачи не
-- распределён, эти фишки не попадут ни в чей current_stack и просто
-- исчезнут из итогового баланса (player_results считает только
-- current_stack - total_buyin, банк в этой формуле не участвует).

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

  if v_room.hand_stage <> 'idle' and v_room.pot > 0 then
    raise exception 'Распределите банк текущей раздачи, прежде чем завершать игру';
  end if;

  update rooms set status = 'finished', finished_at = now()
  where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

grant execute on function finish_game(uuid, uuid) to anon;
