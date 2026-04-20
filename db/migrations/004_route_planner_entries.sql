CREATE TABLE IF NOT EXISTS route_planner_entries (
  id BIGSERIAL PRIMARY KEY,
  bus_id BIGINT NOT NULL REFERENCES buses(id),
  driver_id BIGINT NOT NULL REFERENCES drivers(id),
  company_name VARCHAR(160),
  route_name VARCHAR(160) NOT NULL,
  shift VARCHAR(20) NOT NULL CHECK (shift IN ('general', 'morning', 'afternoon', 'night', 'unknown')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by BIGINT REFERENCES users(id),
  updated_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_planner_entries_active ON route_planner_entries(is_active, id DESC);
CREATE INDEX IF NOT EXISTS idx_route_planner_entries_shift ON route_planner_entries(shift, id DESC);
CREATE INDEX IF NOT EXISTS idx_route_planner_entries_bus ON route_planner_entries(bus_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_route_planner_entries_driver ON route_planner_entries(driver_id, id DESC);
