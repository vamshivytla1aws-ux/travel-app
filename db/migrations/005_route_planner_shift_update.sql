ALTER TABLE route_planner_entries
  DROP CONSTRAINT IF EXISTS route_planner_entries_shift_check;

ALTER TABLE route_planner_entries
  DROP CONSTRAINT IF EXISTS route_planner_entries_shift_allowed_check;

ALTER TABLE route_planner_entries
  ADD CONSTRAINT route_planner_entries_shift_allowed_check
  CHECK (shift IN ('general', 'morning', 'afternoon', 'night', 'unknown'));
