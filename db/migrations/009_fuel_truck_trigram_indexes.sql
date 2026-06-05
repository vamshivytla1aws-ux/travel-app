CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_fuel_trucks_truck_code_trgm
  ON fuel_trucks USING gin (truck_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_fuel_trucks_truck_name_trgm
  ON fuel_trucks USING gin (truck_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_fuel_trucks_registration_number_trgm
  ON fuel_trucks USING gin (registration_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_fuel_truck_refills_fuel_station_name_trgm
  ON fuel_truck_refills USING gin (fuel_station_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_fuel_truck_refills_driver_name_trgm
  ON fuel_truck_refills USING gin (driver_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_fuel_issues_bus_driver_name_trgm
  ON fuel_issues USING gin (bus_driver_name gin_trgm_ops);
