ALTER TABLE route_planner_entries
  ADD COLUMN IF NOT EXISTS assignment_date DATE;

UPDATE route_planner_entries
SET assignment_date = COALESCE(assignment_date, DATE(created_at), CURRENT_DATE)
WHERE assignment_date IS NULL;

ALTER TABLE route_planner_entries
  ALTER COLUMN assignment_date SET DEFAULT CURRENT_DATE;

ALTER TABLE route_planner_entries
  ALTER COLUMN assignment_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_route_planner_entries_date
  ON route_planner_entries(assignment_date DESC, id DESC);
