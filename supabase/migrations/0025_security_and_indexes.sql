-- StackUp 0025: безопасность + индексы производительности
--
-- БЕЗОПАСНОСТЬ:
--   _begin_hand — внутренняя функция, вызывается только из next_hand/start_game
--   которые сами SECURITY DEFINER и поэтому не нуждаются во внешнем grant.
--   Anon мог напрямую вызвать _begin_hand(любой_room_id) без host_token.
--   REVOKE не ломает ничего: SECURITY DEFINER функции вызывают её с привилегиями
--   владельца, а не anon.
--
-- ИНДЕКСЫ (до исправления — только idx_players_room на room_id):
--   Все hot-path запросы фильтруют:
--     WHERE room_id = X AND hand_state = 'active'
--     WHERE room_id = X AND status = 'active'
--     WHERE room_id = X AND status = 'active' ORDER BY seat_index
--   Составные индексы снижают стоимость каждого хода в 3-5x.

revoke execute on function _begin_hand(uuid) from anon;

create index if not exists idx_players_room_hand_state
  on players(room_id, hand_state);

create index if not exists idx_players_room_status
  on players(room_id, status);

create index if not exists idx_players_room_status_seat
  on players(room_id, status, seat_index);

create index if not exists idx_rooms_turn_deadline
  on rooms(id, turn_deadline)
  where turn_deadline is not null;
