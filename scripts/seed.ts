import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { Pool } from "pg";
import { getDbConfig } from "../src/lib/db-config";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const pool = new Pool(getDbConfig());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, precision = 2) {
  return Number((Math.random() * (max - min) + min).toFixed(precision));
}

async function run() {
  const client = await pool.connect();
  try {
    const schemaPath = path.resolve(__dirname, "../schema.sql");
    const schemaSql = await readFile(schemaPath, "utf-8");
    await client.query(schemaSql);

    await client.query("BEGIN");
    await client.query(`
      TRUNCATE TABLE employee_assignments, gps_logs, fuel_entries, maintenance_records, bus_assignments,
      route_stops, routes, employees, drivers, buses, users RESTART IDENTITY CASCADE
    `);

    const adminHash = await bcrypt.hash("Admin@123", 10);
    await client.query(
      `INSERT INTO users(full_name, email, password_hash, role, module_access) VALUES
      ('System Admin', 'admin@transport.local', $1, 'admin', ARRAY['dashboard','buses','trips','drivers','employees','routes','tracking','fuel-entry','fuel-truck','user-admin','logs'])`,
      [adminHash],
    );

    const routeIds: number[] = [];
    for (let i = 1; i <= 20; i += 1) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO routes(route_code, route_name, start_location, end_location, total_distance_km, estimated_duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          `R-${String(i).padStart(3, "0")}`,
          `Route ${i}`,
          `Zone ${randomInt(1, 8)} Start`,
          `Zone ${randomInt(9, 18)} End`,
          randomFloat(14, 52),
          randomInt(35, 130),
        ],
      );
      routeIds.push(result.rows[0].id);
    }

    for (const routeId of routeIds) {
      const stopCount = randomInt(4, 8);
      for (let stop = 1; stop <= stopCount; stop += 1) {
        await client.query(
          `INSERT INTO route_stops(route_id, stop_order, stop_name, latitude, longitude, scheduled_time)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            routeId,
            stop,
            `Stop ${stop}`,
            randomFloat(12.8, 13.2, 6),
            randomFloat(77.3, 77.9, 6),
            `${String(5 + Math.floor(stop / 2)).padStart(2, "0")}:${String(
              randomInt(0, 59),
            ).padStart(2, "0")}:00`,
          ],
        );
      }
    }

    const busIds: number[] = [];
    for (let i = 1; i <= 90; i += 1) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO buses(bus_number, registration_number, make, model, seater, odometer_km, status, last_service_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          `BUS-${String(i).padStart(3, "0")}`,
          `KA01TR${String(1000 + i)}`,
          i % 2 === 0 ? "Ashok Leyland" : "Tata",
          i % 3 === 0 ? "CityRide X" : "Transit Pro",
          randomInt(28, 45),
          randomFloat(25_000, 190_000),
          i % 11 === 0 ? "maintenance" : "active",
          new Date(Date.now() - randomInt(4, 90) * 86400000),
        ],
      );
      busIds.push(result.rows[0].id);
    }

    const driverIds: number[] = [];
    for (let i = 1; i <= 120; i += 1) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO drivers(full_name, phone, license_number, license_expiry, experience_years, is_active)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          `Driver ${i}`,
          `90000${String(10000 + i)}`,
          `DL-${randomInt(10, 99)}-${randomInt(100000, 999999)}`,
          new Date(Date.now() + randomInt(180, 1200) * 86400000),
          randomInt(2, 18),
          true,
        ],
      );
      driverIds.push(result.rows[0].id);
    }

    const departments = ["Engineering", "Finance", "Sales", "Operations", "HR", "Support"];
    const employeeIds: number[] = [];
    for (let i = 1; i <= 780; i += 1) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO employees(employee_code, full_name, phone, email, department, shift_start, shift_end, pickup_address, drop_address, latitude, longitude)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          `EMP-${String(i).padStart(4, "0")}`,
          `Employee ${i}`,
          `80000${String(10000 + i)}`,
          `employee${i}@company.local`,
          departments[i % departments.length],
          i % 2 === 0 ? "08:00:00" : "09:00:00",
          i % 2 === 0 ? "17:00:00" : "18:00:00",
          `Pickup Street ${i}`,
          `Drop Street ${i}`,
          randomFloat(12.8, 13.2, 6),
          randomFloat(77.3, 77.9, 6),
        ],
      );
      employeeIds.push(result.rows[0].id);
    }

    const assignmentIds: number[] = [];
    for (let i = 0; i < busIds.length; i += 1) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO bus_assignments(bus_id, driver_id, route_id, assignment_date, shift_label, status)
         VALUES($1,$2,$3,CURRENT_DATE,$4,$5) RETURNING id`,
        [
          busIds[i],
          driverIds[i % driverIds.length],
          routeIds[i % routeIds.length],
          i % 2 === 0 ? "Morning" : "Evening",
          i % 13 === 0 ? "in_transit" : "scheduled",
        ],
      );
      assignmentIds.push(result.rows[0].id);
    }

    for (let i = 0; i < assignmentIds.length; i += 1) {
      const pax = randomInt(20, 36);
      for (let n = 0; n < pax; n += 1) {
        await client.query(
          `INSERT INTO employee_assignments(employee_id, bus_assignment_id, seat_number)
           VALUES($1,$2,$3)
           ON CONFLICT DO NOTHING`,
          [employeeIds[(i * 8 + n) % employeeIds.length], assignmentIds[i], `S-${n + 1}`],
        );
      }
    }

    for (const busId of busIds) {
      for (let d = 0; d < 7; d += 1) {
        const odoBefore = randomFloat(30_000, 200_000);
        const odoAfter = odoBefore + randomFloat(60, 210);
        const liters = randomFloat(18, 46);
        await client.query(
          `INSERT INTO fuel_entries(bus_id, driver_id, filled_at, odometer_before_km, odometer_after_km, liters, amount, fuel_station)
           VALUES($1,$2,NOW() - ($3 || ' days')::interval,$4,$5,$6,$7,$8)`,
          [
            busId,
            driverIds[(busId + d) % driverIds.length],
            d,
            odoBefore,
            odoAfter,
            liters,
            Number((liters * randomFloat(89, 96)).toFixed(2)),
            `Station ${randomInt(1, 16)}`,
          ],
        );
      }

      for (let m = 0; m < 5; m += 1) {
        await client.query(
          `INSERT INTO maintenance_records(bus_id, maintenance_date, issue_type, description, vendor_name, cost, odometer_km, next_service_due_km)
           VALUES($1,CURRENT_DATE - ($2 || ' days')::interval,$3,$4,$5,$6,$7,$8)`,
          [
            busId,
            randomInt(8, 240),
            ["Engine", "Tyre", "Brake", "Oil Change"][m % 4],
            `Maintenance ticket ${randomUUID().slice(0, 8)}`,
            `Vendor ${randomInt(1, 20)}`,
            randomFloat(1500, 25000),
            randomFloat(32_000, 205_000),
            randomFloat(35_000, 210_000),
          ],
        );
      }

      for (let g = 0; g < 12; g += 1) {
        await client.query(
          `INSERT INTO gps_logs(bus_id, driver_id, logged_at, latitude, longitude, speed_kmph, heading_degrees, assignment_id)
           VALUES($1,$2,NOW() - ($3 || ' minutes')::interval,$4,$5,$6,$7,$8)`,
          [
            busId,
            driverIds[(busId + g) % driverIds.length],
            g * 5,
            randomFloat(12.8, 13.2, 6),
            randomFloat(77.3, 77.9, 6),
            randomFloat(12, 58),
            randomFloat(0, 359),
            assignmentIds[busId % assignmentIds.length],
          ],
        );
      }
    }

    const truckResult = await client.query<{ id: number }>(
      `INSERT INTO fuel_trucks(
        truck_code, truck_name, registration_number, tank_capacity_liters, current_available_liters, low_stock_threshold_liters, status
      )
       VALUES
       ('FT-001', 'Main Diesel Truck', 'KA01FT1001', 12000, 6500, 1500, 'active'),
       ('FT-002', 'Backup Diesel Truck', 'KA01FT1002', 10000, 2200, 1200, 'active')
       RETURNING id`,
    );
    const fuelTruckIds = truckResult.rows.map((row) => row.id);

    for (const fuelTruckId of fuelTruckIds) {
      for (let d = 0; d < 5; d += 1) {
        const qtyIn = randomFloat(900, 2200);
        const rate = randomFloat(88, 97);
        const total = Number((qtyIn * rate).toFixed(2));
        await client.query(
          `INSERT INTO fuel_truck_refills(
             fuel_truck_id, refill_date, refill_time, odometer_reading, fuel_station_name, vendor_name,
             quantity_liters, rate_per_liter, total_amount, bill_number, payment_mode, driver_name
           )
           VALUES($1, CURRENT_DATE - ($2 || ' days')::interval, ($3 || ':00')::time, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [
            fuelTruckId,
            d,
            `${String(7 + d).padStart(2, "0")}:${String(randomInt(0, 50)).padStart(2, "0")}`,
            randomFloat(10_000, 50_000),
            `Station ${randomInt(1, 8)}`,
            `Vendor ${randomInt(1, 6)}`,
            qtyIn,
            rate,
            total,
            `BILL-${randomInt(1000, 9999)}`,
            ["cash", "card", "upi"][randomInt(0, 2)],
            `Driver ${randomInt(1, 30)}`,
          ],
        );
      }
    }

    for (let n = 0; n < 120; n += 1) {
      const fuelTruckId = fuelTruckIds[n % fuelTruckIds.length];
      await client.query(
        `INSERT INTO fuel_issues(
           fuel_truck_id, bus_id, issue_date, issue_time, liters_issued, issued_by_name, bus_driver_name, route_reference, remarks
         )
         VALUES(
           $1, $2, CURRENT_DATE - ($3 || ' days')::interval, ($4 || ':00')::time, $5, $6, $7, $8, $9
         )`,
        [
          fuelTruckId,
          busIds[n % busIds.length],
          randomInt(0, 6),
          `${String(randomInt(6, 20)).padStart(2, "0")}:${String(randomInt(0, 59)).padStart(2, "0")}`,
          randomFloat(20, 140),
          "Fuel Supervisor",
          `Driver ${randomInt(1, 120)}`,
          `R-${String(randomInt(1, 20)).padStart(3, "0")}`,
          "Daily issue",
        ],
      );
    }

    await client.query("COMMIT");
    console.log("Database seeded successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
