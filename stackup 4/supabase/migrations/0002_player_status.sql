-- StackUp: статус игрока — позволяет «убрать игрока со стола», если он ушёл
-- раньше времени, без потери его записи в итоговой статистике.

alter table players
  add column status text not null default 'active' check (status in ('active', 'left'));

-- Организатор убирает игрока со стола. Стек фиксируется на момент ухода —
-- баланс (sum(result) = 0) продолжает сходиться, т.к. чипы игрока остаются
-- учтены в его финальном результате.
create or replace function remove_player(p_room_id uuid, p_host_token uuid, p_player_id uuid)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player players;
begin
  if not _check_host(p_room_id, p_host_token) then
    raise exception 'Not authorized';
  end if;

  select * into v_player from players where id = p_player_id and room_id = p_room_id;
  if not found then
    raise exception 'Player not found';
  end if;

  update players set status = 'left'
  where id = p_player_id
  returning * into v_player;

  return v_player;
end;
$$;

grant execute on function remove_player(uuid, uuid, uuid) to anon;
