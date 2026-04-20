DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fuel_trucks'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fuel_trucks_capacity_balance_check'
  ) THEN
    ALTER TABLE fuel_trucks
    ADD CONSTRAINT fuel_trucks_capacity_balance_check
    CHECK (current_available_liters <= tank_capacity_liters);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fuel_truck_ledger'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fuel_truck_ledger_single_direction_check'
  ) THEN
    ALTER TABLE fuel_truck_ledger
    ADD CONSTRAINT fuel_truck_ledger_single_direction_check
    CHECK (
      (quantity_in = 0 AND quantity_out >= 0)
      OR (quantity_out = 0 AND quantity_in >= 0)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fuel_truck_ledger'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fuel_truck_ledger_stock_math_check'
  ) THEN
    ALTER TABLE fuel_truck_ledger
    ADD CONSTRAINT fuel_truck_ledger_stock_math_check
    CHECK (closing_stock = opening_stock + quantity_in - quantity_out);
  END IF;
END $$;
