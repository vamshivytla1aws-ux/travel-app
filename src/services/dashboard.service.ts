import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { appDateFromTimestamptzSql, appTodaySql } from "@/lib/timezone";

export type DashboardExceptionAlert = {
  id: string;
  category:
    | "mileage_drop"
    | "low_fuel_stock"
    | "missed_trip_start"
    | "expiring_dl"
    | "expiring_badge"
    | "finance_emi";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  at: string | null;
  actionLabel: string;
  actionHref: string;
  moduleKey:
    | "buses"
    | "fuel-truck"
    | "trips"
    | "drivers"
    | "finance";
};

export class DashboardService {
  async getExceptions(): Promise<DashboardExceptionAlert[]> {
    await ensureTransportEnhancements();
    const appToday = appTodaySql();
    const [mileageDrops, lowStock, missedTripStarts, expiringDriverDocs, expiringEmis] = await Promise.all([
      query<{
        bus_id: number;
        bus_number: string;
        registration_number: string;
        latest_kmpl: string;
        previous_kmpl: string;
        latest_at: string;
      }>(
        `
        WITH fuel_events AS (
          SELECT
            fe.bus_id,
            b.bus_number,
            b.registration_number,
            fe.filled_at AS event_at,
            CASE
              WHEN fe.liters > 0
               AND fe.odometer_after_km IS NOT NULL
               AND fe.odometer_before_km IS NOT NULL
              THEN (fe.odometer_after_km - fe.odometer_before_km) / fe.liters
              ELSE NULL
            END AS kmpl,
            fe.id AS source_id
          FROM fuel_entries fe
          JOIN buses b ON b.id = fe.bus_id
          UNION ALL
          SELECT
            fi.bus_id,
            b.bus_number,
            b.registration_number,
            (fi.issue_date::timestamp + fi.issue_time) AS event_at,
            CASE
              WHEN fi.liters_issued > 0
               AND fi.odometer_after_km IS NOT NULL
               AND fi.odometer_before_km IS NOT NULL
              THEN (fi.odometer_after_km - fi.odometer_before_km) / fi.liters_issued
              ELSE NULL
            END AS kmpl,
            fi.id AS source_id
          FROM fuel_issues fi
          JOIN buses b ON b.id = fi.bus_id
        ),
        ranked AS (
          SELECT
            bus_id,
            bus_number,
            registration_number,
            event_at,
            kmpl,
            ROW_NUMBER() OVER (PARTITION BY bus_id ORDER BY event_at DESC, source_id DESC) AS rn
          FROM fuel_events
          WHERE kmpl IS NOT NULL
        ),
        paired AS (
          SELECT
            r1.bus_id,
            r1.bus_number,
            r1.registration_number,
            r1.kmpl AS latest_kmpl,
            r2.kmpl AS previous_kmpl,
            r1.event_at AS latest_at
          FROM ranked r1
          JOIN ranked r2 ON r2.bus_id = r1.bus_id AND r2.rn = 2
          WHERE r1.rn = 1
        )
        SELECT
          bus_id,
          bus_number,
          registration_number,
          ROUND(latest_kmpl::numeric, 2)::text AS latest_kmpl,
          ROUND(previous_kmpl::numeric, 2)::text AS previous_kmpl,
          latest_at::text
        FROM paired
        WHERE latest_kmpl < (previous_kmpl * 0.85)
        ORDER BY latest_at DESC
        LIMIT 8
        `,
      ),
      query<{
        id: number;
        truck_code: string;
        truck_name: string;
        current_available_liters: string;
        low_stock_threshold_liters: string;
        updated_at: string;
      }>(
        `
        SELECT
          id,
          truck_code,
          truck_name,
          current_available_liters::text,
          low_stock_threshold_liters::text,
          updated_at::text
        FROM fuel_trucks
        WHERE status = 'active'
          AND current_available_liters <= low_stock_threshold_liters
        ORDER BY current_available_liters ASC, id ASC
        LIMIT 8
        `,
      ),
      query<{
        id: number;
        bus_number: string;
        driver_name: string;
        route_name: string;
        shift_label: string;
        trip_date: string;
      }>(
        `
        SELECT
          tr.id,
          b.bus_number,
          d.full_name AS driver_name,
          r.route_name,
          tr.shift_label,
          tr.trip_date::text
        FROM trip_runs tr
        JOIN buses b ON b.id = tr.bus_id
        JOIN drivers d ON d.id = tr.driver_id
        JOIN routes r ON r.id = tr.route_id
        WHERE tr.trip_date = ${appToday}
          AND tr.status = 'planned'
          AND tr.created_at < NOW() - INTERVAL '60 minutes'
        ORDER BY tr.created_at ASC
        LIMIT 8
        `,
      ),
      query<{
        id: number;
        full_name: string;
        license_expiry: string | null;
        badge_validity: string | null;
      }>(
        `
        SELECT
          d.id,
          d.full_name,
          d.license_expiry::text,
          dp.badge_validity::text
        FROM drivers d
        LEFT JOIN driver_profiles dp ON dp.driver_id = d.id
        WHERE d.is_active = true
          AND (
            (d.license_expiry IS NOT NULL AND d.license_expiry <= ${appToday} + INTERVAL '15 days')
            OR (dp.badge_validity IS NOT NULL AND dp.badge_validity <= ${appToday} + INTERVAL '15 days')
          )
        ORDER BY LEAST(
          COALESCE(d.license_expiry, DATE '9999-12-31'),
          COALESCE(dp.badge_validity, DATE '9999-12-31')
        ) ASC
        LIMIT 20
        `,
      ),
      query<{
        id: number;
        registration_no: string;
        next_emi_date: string;
        status: string;
      }>(
        `
        SELECT
          id,
          registration_no,
          next_emi_date::text,
          status
        FROM finance_loans
        WHERE status IN ('active', 'overdue')
          AND next_emi_date IS NOT NULL
          AND next_emi_date <= ${appToday} + INTERVAL '7 days'
        ORDER BY next_emi_date ASC
        LIMIT 12
        `,
      ),
    ]);

    const alerts: DashboardExceptionAlert[] = [];

    mileageDrops.rows.forEach((row) => {
      alerts.push({
        id: `mileage-drop-${row.bus_id}`,
        category: "mileage_drop",
        severity: "warning",
        title: `Mileage drop: ${row.bus_number} (${row.registration_number})`,
        description: `KM/L dropped from ${row.previous_kmpl} to ${row.latest_kmpl}.`,
        at: row.latest_at,
        actionLabel: "Fix now",
        actionHref: `/buses/${row.bus_id}`,
        moduleKey: "buses",
      });
    });

    lowStock.rows.forEach((row) => {
      alerts.push({
        id: `low-stock-${row.id}`,
        category: "low_fuel_stock",
        severity: "critical",
        title: `Low stock: ${row.truck_code} - ${row.truck_name}`,
        description: `${Number(row.current_available_liters).toFixed(2)} L remaining (threshold ${Number(row.low_stock_threshold_liters).toFixed(2)} L).`,
        at: row.updated_at,
        actionLabel: "Fix now",
        actionHref: `/fuel-trucks/${row.id}`,
        moduleKey: "fuel-truck",
      });
    });

    missedTripStarts.rows.forEach((row) => {
      alerts.push({
        id: `missed-trip-${row.id}`,
        category: "missed_trip_start",
        severity: "critical",
        title: `Missed trip start: Bus ${row.bus_number}`,
        description: `${row.driver_name} on ${row.route_name} (${row.shift_label}) has not started yet.`,
        at: row.trip_date,
        actionLabel: "Fix now",
        actionHref: "/trips",
        moduleKey: "trips",
      });
    });

    expiringDriverDocs.rows.forEach((row) => {
      if (row.license_expiry) {
        const isExpired = new Date(row.license_expiry) < new Date();
        alerts.push({
          id: `driver-dl-${row.id}`,
          category: "expiring_dl",
          severity: isExpired ? "critical" : "warning",
          title: `${isExpired ? "Expired" : "Expiring"} DL: ${row.full_name}`,
          description: `Driving License validity date: ${row.license_expiry}.`,
          at: row.license_expiry,
          actionLabel: "Fix now",
          actionHref: `/drivers/${row.id}`,
          moduleKey: "drivers",
        });
      }
      if (row.badge_validity) {
        const isExpired = new Date(row.badge_validity) < new Date();
        alerts.push({
          id: `driver-badge-${row.id}`,
          category: "expiring_badge",
          severity: isExpired ? "critical" : "warning",
          title: `${isExpired ? "Expired" : "Expiring"} badge: ${row.full_name}`,
          description: `Badge validity date: ${row.badge_validity}.`,
          at: row.badge_validity,
          actionLabel: "Fix now",
          actionHref: `/drivers/${row.id}`,
          moduleKey: "drivers",
        });
      }
    });

    expiringEmis.rows.forEach((row) => {
      const isPast = new Date(row.next_emi_date) < new Date();
      alerts.push({
        id: `emi-${row.id}`,
        category: "finance_emi",
        severity: isPast || row.status === "overdue" ? "critical" : "warning",
        title: `EMI ${isPast || row.status === "overdue" ? "overdue" : "due soon"}: ${row.registration_no}`,
        description: `Next EMI date: ${row.next_emi_date}.`,
        at: row.next_emi_date,
        actionLabel: "Fix now",
        actionHref: `/finance/${row.id}`,
        moduleKey: "finance",
      });
    });

    const severityRank: Record<DashboardExceptionAlert["severity"], number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };
    alerts.sort((a, b) => {
      const severityDelta = severityRank[a.severity] - severityRank[b.severity];
      if (severityDelta !== 0) return severityDelta;
      const aTime = a.at ? new Date(a.at).getTime() : 0;
      const bTime = b.at ? new Date(b.at).getTime() : 0;
      return bTime - aTime;
    });

    return alerts.slice(0, 25);
  }

  async getSummary() {
    await ensureTransportEnhancements();
    const appToday = appTodaySql();
    const filledAtDay = appDateFromTimestamptzSql("filled_at");
    const [fleet, drivers, employees, activeAssignments, fuelToday, exceptions] = await Promise.all([
      query<{ total: string; active: string; maintenance: string }>(
        `SELECT
          COUNT(*)::text as total,
          COUNT(*) FILTER (WHERE status = 'active')::text as active,
          COUNT(*) FILTER (WHERE status = 'maintenance')::text as maintenance
         FROM buses`,
      ),
      query<{ total: string }>(`SELECT COUNT(*)::text as total FROM drivers WHERE is_active = true`),
      query<{ total: string }>(`SELECT COUNT(*)::text as total FROM employees WHERE is_active = true`),
      query<{ total: string }>(
        `SELECT COUNT(*)::text as total
         FROM bus_assignments
         WHERE assignment_date = ${appToday} AND status IN ('scheduled', 'in_transit')`,
      ),
      query<{ liters: string; amount: string }>(
        `SELECT
           COALESCE(SUM(liters_issued),0)::text as liters,
           COALESCE(SUM(amount),0)::text as amount
         FROM fuel_issues
         WHERE issue_date = ${appToday}`,
      ),
      this.getExceptions(),
    ]);

    const fuelTrend = await query<{ day: string; liters: string }>(
      `SELECT
         TO_CHAR(day, 'YYYY-MM-DD') as day,
         SUM(liters)::text as liters
       FROM (
         SELECT ${filledAtDay} as day, liters
         FROM fuel_entries
         WHERE ${filledAtDay} >= ${appToday} - INTERVAL '13 days'
         UNION ALL
         SELECT issue_date as day, liters_issued as liters
         FROM fuel_issues
         WHERE issue_date >= ${appToday} - INTERVAL '13 days'
       ) fuel
       GROUP BY day
       ORDER BY day ASC`,
    );

    const recentActivity = await query<{
      type: string;
      title: string;
      at: string;
    }>(
      `(
          SELECT 'fuel' as type, CONCAT('Fuel entry for bus #', bus_id) as title, filled_at::text as at
          FROM fuel_entries
          ORDER BY filled_at DESC
          LIMIT 6
       )
       UNION ALL
       (
          SELECT 'fuel' as type, CONCAT('Diesel issue to bus #', bus_id) as title, (issue_date::text || 'T' || issue_time::text) as at
          FROM fuel_issues
          ORDER BY issue_date DESC, issue_time DESC
          LIMIT 6
       )
       UNION ALL
       (
          SELECT 'maintenance' as type, CONCAT('Maintenance: ', issue_type) as title, maintenance_date::text as at
          FROM maintenance_records
          ORDER BY maintenance_date DESC
          LIMIT 6
       )
       ORDER BY at DESC
       LIMIT 10`,
    );

    const tripStats = await query<{
      planned: string;
      in_progress: string;
      completed: string;
      cancelled: string;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'planned')::text as planned,
       COUNT(*) FILTER (WHERE status = 'in_progress')::text as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed')::text as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::text as cancelled
       FROM trip_runs
       WHERE trip_date = ${appToday}`,
    );

    return {
      fleet: fleet.rows[0],
      drivers: drivers.rows[0],
      employees: employees.rows[0],
      activeAssignments: activeAssignments.rows[0],
      fuelToday: fuelToday.rows[0],
      tripStats: tripStats.rows[0] ?? {
        planned: "0",
        in_progress: "0",
        completed: "0",
        cancelled: "0",
      },
      fuelTrend: fuelTrend.rows,
      recentActivity: recentActivity.rows,
      exceptions,
    };
  }
}
