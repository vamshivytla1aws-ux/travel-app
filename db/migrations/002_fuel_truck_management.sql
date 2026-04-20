CREATE TABLE IF NOT EXISTS fuel_trucks (
  id BIGSERIAL PRIMARY KEY,
  truck_code VARCHAR(40) NOT NULL UNIQUE,
  truck_name VARCHAR(120) NOT NULL,
  registration_number VARCHAR(40) NOT NULL UNIQUE,
  tank_capacity_liters NUMERIC(12,2) NOT NULL CHECK (tank_capacity_liters > 0),
  current_available_liters NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (current_available_liters >= 0),
  low_stock_threshold_liters NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (low_stock_threshold_liters >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_by BIGINT REFERENCES users(id),
  updated_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fuel_trucks_capacity_balance_check CHECK (current_available_liters <= tank_capacity_liters)
);

CREATE TABLE IF NOT EXISTS fuel_truck_refills (
  id BIGSERIAL PRIMARY KEY,
  fuel_truck_id BIGINT NOT NULL REFERENCES fuel_trucks(id) ON DELETE CASCADE,
  refill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  refill_time TIME NOT NULL DEFAULT CURRENT_TIME,
  odometer_reading NUMERIC(12,2) CHECK (odometer_reading >= 0),
  fuel_station_name VARCHAR(120),
  vendor_name VARCHAR(120),
  quantity_liters NUMERIC(12,2) NOT NULL CHECK (quantity_liters > 0),
  rate_per_liter NUMERIC(12,2) NOT NULL CHECK (rate_per_liter > 0),
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  bill_number VARCHAR(80),
  payment_mode VARCHAR(40),
  driver_name VARCHAR(120),
  notes TEXT,
  receipt_file_name VARCHAR(255),
  receipt_mime_type VARCHAR(120),
  receipt_size_bytes INTEGER,
  receipt_data BYTEA,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_issues (
  id BIGSERIAL PRIMARY KEY,
  fuel_truck_id BIGINT NOT NULL REFERENCES fuel_trucks(id) ON DELETE CASCADE,
  bus_id BIGINT NOT NULL REFERENCES buses(id),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issue_time TIME NOT NULL DEFAULT CURRENT_TIME,
  liters_issued NUMERIC(12,2) NOT NULL CHECK (liters_issued > 0),
  issued_by_name VARCHAR(120),
  bus_driver_name VARCHAR(120),
  route_reference VARCHAR(120),
  remarks TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_truck_ledger (
  id BIGSERIAL PRIMARY KEY,
  fuel_truck_id BIGINT NOT NULL REFERENCES fuel_trucks(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('REFILL', 'ISSUE', 'ADJUSTMENT')),
  reference_id BIGINT,
  reference_type VARCHAR(40),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_time TIME NOT NULL DEFAULT CURRENT_TIME,
  opening_stock NUMERIC(12,2) NOT NULL CHECK (opening_stock >= 0),
  quantity_in NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantity_in >= 0),
  quantity_out NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantity_out >= 0),
  closing_stock NUMERIC(12,2) NOT NULL CHECK (closing_stock >= 0),
  remarks TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fuel_truck_ledger_single_direction_check CHECK (
    (quantity_in = 0 AND quantity_out >= 0) OR (quantity_out = 0 AND quantity_in >= 0)
  ),
  CONSTRAINT fuel_truck_ledger_stock_math_check CHECK (
    closing_stock = opening_stock + quantity_in - quantity_out
  )
);

CREATE INDEX IF NOT EXISTS idx_fuel_truck_refills_truck_date ON fuel_truck_refills(fuel_truck_id, refill_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_issues_truck_date ON fuel_issues(fuel_truck_id, issue_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_issues_bus_date ON fuel_issues(bus_id, issue_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_truck_ledger_truck_date ON fuel_truck_ledger(fuel_truck_id, transaction_date DESC, id DESC);

