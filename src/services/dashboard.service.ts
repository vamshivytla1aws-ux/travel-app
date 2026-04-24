import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { appDateFromTimestamptzSql, appTodaySql } from "@/lib/timezone";

export class DashboardService {
  async getSummary() {
    await ensureTransportEnhancements();
    const appToday = appTodaySql();
    const filledAtDay = appDateFromTimestamptzSql("filled_at");
    const [fleet, drivers, employees, activeAssignments, fuelToday] = await Promise.all([
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
    };
  }
}
