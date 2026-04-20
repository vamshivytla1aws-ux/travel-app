import { query } from "@/lib/db";
import { ensureDocumentTables } from "@/lib/document-storage";

export async function ensureTransportEnhancements() {
  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'buses' AND column_name = 'capacity'
      ) THEN
        ALTER TABLE buses RENAME COLUMN capacity TO seater;
      END IF;
    END $$;
  `);
  await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS company_name VARCHAR(120);`);
  await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120);`);
  await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(40);`);
  await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(30);`);
  await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS pf_account_number VARCHAR(40);`);
  await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS uan_number VARCHAR(40);`);
  await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS profile_photo_name VARCHAR(255);`);
  await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS profile_photo_mime VARCHAR(120);`);
  await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS profile_photo_data BYTEA;`);

  await query(`ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;`);
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_name VARCHAR(120);`);
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20);`);
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);`);
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS valid_from DATE;`);
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS valid_to DATE;`);
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_photo_name VARCHAR(255);`);
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_photo_mime VARCHAR(120);`);
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_photo_data BYTEA;`);
  await query(`ALTER TABLE fuel_entries ADD COLUMN IF NOT EXISTS company_name VARCHAR(120);`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS module_access TEXT[] NOT NULL DEFAULT ARRAY['dashboard'];`);
  await query(`
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
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`
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
  `);
  await query(`
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
  `);
  await query(`
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_fuel_truck_refills_truck_date ON fuel_truck_refills(fuel_truck_id, refill_date DESC, id DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fuel_issues_truck_date ON fuel_issues(fuel_truck_id, issue_date DESC, id DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fuel_issues_bus_date ON fuel_issues(bus_id, issue_date DESC, id DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fuel_truck_ledger_truck_date ON fuel_truck_ledger(fuel_truck_id, transaction_date DESC, id DESC);`);
  await query(`
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
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_route_planner_entries_active ON route_planner_entries(is_active, id DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_route_planner_entries_shift ON route_planner_entries(shift, id DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_route_planner_entries_bus ON route_planner_entries(bus_id, id DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_route_planner_entries_driver ON route_planner_entries(driver_id, id DESC);`);
  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'route_planner_entries_shift_check'
      ) THEN
        ALTER TABLE route_planner_entries DROP CONSTRAINT route_planner_entries_shift_check;
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'route_planner_entries_shift_allowed_check'
      ) THEN
        ALTER TABLE route_planner_entries
        ADD CONSTRAINT route_planner_entries_shift_allowed_check
        CHECK (shift IN ('general', 'morning', 'afternoon', 'night', 'unknown'));
      END IF;
    END $$;
  `);
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fuel_trucks_capacity_balance_check'
      ) THEN
        ALTER TABLE fuel_trucks
        ADD CONSTRAINT fuel_trucks_capacity_balance_check
        CHECK (current_available_liters <= tank_capacity_liters);
      END IF;
    END $$;
  `);
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fuel_truck_ledger_single_direction_check'
      ) THEN
        ALTER TABLE fuel_truck_ledger
        ADD CONSTRAINT fuel_truck_ledger_single_direction_check
        CHECK (
          (quantity_in = 0 AND quantity_out >= 0)
          OR (quantity_out = 0 AND quantity_in >= 0)
        );
      END IF;
    END $$;
  `);
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fuel_truck_ledger_stock_math_check'
      ) THEN
        ALTER TABLE fuel_truck_ledger
        ADD CONSTRAINT fuel_truck_ledger_stock_math_check
        CHECK (closing_stock = opening_stock + quantity_in - quantity_out);
      END IF;
    END $$;
  `);
  await query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role')
         AND NOT EXISTS (
           SELECT 1
           FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
           WHERE t.typname = 'user_role' AND e.enumlabel = 'updater'
         ) THEN
        ALTER TYPE user_role ADD VALUE 'updater';
      END IF;
    END $$;
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_status') THEN
        CREATE TYPE trip_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
      END IF;
    END $$;
  `);

  await query(`
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
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_trip_runs_date_status ON trip_runs(trip_date, status);`);
  await query(`
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
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);`);
  await ensureDocumentTables();
}
