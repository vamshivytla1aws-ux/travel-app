DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'dispatcher', 'fuel_manager', 'viewer', 'updater');
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'updater'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'updater';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bus_status') THEN
    CREATE TYPE bus_status AS ENUM ('active', 'maintenance', 'inactive');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
    CREATE TYPE assignment_status AS ENUM ('scheduled', 'in_transit', 'completed', 'cancelled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_status') THEN
    CREATE TYPE trip_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  module_access TEXT[] NOT NULL DEFAULT ARRAY['dashboard'],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  user_email VARCHAR(160),
  action VARCHAR(40) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id BIGINT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buses (
  id BIGSERIAL PRIMARY KEY,
  bus_number VARCHAR(32) UNIQUE NOT NULL,
  registration_number VARCHAR(32) UNIQUE NOT NULL,
  make VARCHAR(64) NOT NULL,
  model VARCHAR(64) NOT NULL,
  seater INTEGER NOT NULL CHECK (seater > 0),
  odometer_km NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status bus_status NOT NULL DEFAULT 'active',
  last_service_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivers (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  license_number VARCHAR(40) UNIQUE NOT NULL,
  license_expiry DATE NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  employee_code VARCHAR(30) UNIQUE NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(160) UNIQUE,
  department VARCHAR(80) NOT NULL,
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  pickup_address TEXT NOT NULL,
  drop_address TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routes (
  id BIGSERIAL PRIMARY KEY,
  route_code VARCHAR(30) UNIQUE NOT NULL,
  route_name VARCHAR(120) NOT NULL,
  start_location VARCHAR(120) NOT NULL,
  end_location VARCHAR(120) NOT NULL,
  total_distance_km NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_stops (
  id BIGSERIAL PRIMARY KEY,
  route_id BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL CHECK (stop_order > 0),
  stop_name VARCHAR(120) NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  scheduled_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(route_id, stop_order)
);

CREATE TABLE IF NOT EXISTS bus_assignments (
  id BIGSERIAL PRIMARY KEY,
  bus_id BIGINT NOT NULL REFERENCES buses(id),
  driver_id BIGINT NOT NULL REFERENCES drivers(id),
  route_id BIGINT NOT NULL REFERENCES routes(id),
  assignment_date DATE NOT NULL,
  shift_label VARCHAR(50) NOT NULL,
  status assignment_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bus_id, assignment_date, shift_label)
);

CREATE TABLE IF NOT EXISTS employee_assignments (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  bus_assignment_id BIGINT NOT NULL REFERENCES bus_assignments(id) ON DELETE CASCADE,
  seat_number VARCHAR(10),
  pickup_stop_id BIGINT REFERENCES route_stops(id),
  drop_stop_id BIGINT REFERENCES route_stops(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, bus_assignment_id)
);

CREATE TABLE IF NOT EXISTS fuel_entries (
  id BIGSERIAL PRIMARY KEY,
  bus_id BIGINT NOT NULL REFERENCES buses(id),
  driver_id BIGINT REFERENCES drivers(id),
  filled_at TIMESTAMPTZ NOT NULL,
  odometer_before_km NUMERIC(12, 2) NOT NULL CHECK (odometer_before_km >= 0),
  odometer_after_km NUMERIC(12, 2) NOT NULL CHECK (odometer_after_km >= odometer_before_km),
  liters NUMERIC(10, 2) NOT NULL CHECK (liters > 0),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  fuel_station VARCHAR(120),
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gps_logs (
  id BIGSERIAL PRIMARY KEY,
  bus_id BIGINT NOT NULL REFERENCES buses(id),
  driver_id BIGINT REFERENCES drivers(id),
  logged_at TIMESTAMPTZ NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  speed_kmph NUMERIC(8, 2) NOT NULL DEFAULT 0,
  heading_degrees NUMERIC(6, 2),
  assignment_id BIGINT REFERENCES bus_assignments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id BIGSERIAL PRIMARY KEY,
  bus_id BIGINT NOT NULL REFERENCES buses(id),
  maintenance_date DATE NOT NULL,
  issue_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  vendor_name VARCHAR(120),
  cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  odometer_km NUMERIC(12, 2),
  next_service_due_km NUMERIC(12, 2),
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bus_documents (
  id BIGSERIAL PRIMARY KEY,
  bus_id BIGINT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  document_type VARCHAR(60) NOT NULL,
  document_name VARCHAR(160) NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_documents (
  id BIGSERIAL PRIMARY KEY,
  driver_id BIGINT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  document_type VARCHAR(60) NOT NULL,
  document_name VARCHAR(160) NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS trip_runs (
  id BIGSERIAL PRIMARY KEY,
  trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_label VARCHAR(50) NOT NULL,
  bus_id BIGINT NOT NULL REFERENCES buses(id),
  driver_id BIGINT NOT NULL REFERENCES drivers(id),
  route_id BIGINT NOT NULL REFERENCES routes(id),
  assignment_id BIGINT REFERENCES bus_assignments(id),
  status trip_status NOT NULL DEFAULT 'planned',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  odometer_start_km NUMERIC(12,2),
  odometer_end_km NUMERIC(12,2),
  km_run NUMERIC(12,2),
  liters_filled NUMERIC(10,2),
  mileage_kmpl NUMERIC(10,2),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bus_id, trip_date, shift_label)
);

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(120);

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(40),
  ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(30),
  ADD COLUMN IF NOT EXISTS pf_account_number VARCHAR(40),
  ADD COLUMN IF NOT EXISTS uan_number VARCHAR(40),
  ADD COLUMN IF NOT EXISTS profile_photo_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS profile_photo_mime VARCHAR(120),
  ADD COLUMN IF NOT EXISTS profile_photo_data BYTEA;

ALTER TABLE fuel_entries
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(120);

ALTER TABLE employees
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10),
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE,
  ADD COLUMN IF NOT EXISTS profile_photo_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS profile_photo_mime VARCHAR(120),
  ADD COLUMN IF NOT EXISTS profile_photo_data BYTEA;

ALTER TABLE bus_documents
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS file_data BYTEA;

ALTER TABLE driver_documents
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS file_data BYTEA;

ALTER TABLE bus_documents ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE driver_documents ALTER COLUMN file_url DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buses' AND column_name = 'capacity'
  ) THEN
    ALTER TABLE buses RENAME COLUMN capacity TO seater;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bus_assignments_date ON bus_assignments(assignment_date);
CREATE INDEX IF NOT EXISTS idx_fuel_entries_bus_time ON fuel_entries(bus_id, filled_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_logs_bus_time ON gps_logs(bus_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_bus_date ON maintenance_records(bus_id, maintenance_date DESC);
CREATE INDEX IF NOT EXISTS idx_bus_documents_bus ON bus_documents(bus_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_documents_driver ON driver_documents(driver_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_truck_refills_truck_date ON fuel_truck_refills(fuel_truck_id, refill_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_issues_truck_date ON fuel_issues(fuel_truck_id, issue_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_issues_bus_date ON fuel_issues(bus_id, issue_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_truck_ledger_truck_date ON fuel_truck_ledger(fuel_truck_id, transaction_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_trip_runs_date_status ON trip_runs(trip_date, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
