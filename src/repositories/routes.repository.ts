import { query } from "@/lib/db";
import { Route } from "@/lib/types";

type RouteRow = {
  id: number;
  route_code: string;
  route_name: string;
  start_location: string;
  end_location: string;
  total_distance_km: string;
  estimated_duration_minutes: number;
  is_active: boolean;
};

function mapRoute(row: RouteRow): Route {
  return {
    id: row.id,
    routeCode: row.route_code,
    routeName: row.route_name,
    startLocation: row.start_location,
    endLocation: row.end_location,
    totalDistanceKm: Number(row.total_distance_km),
    estimatedDurationMinutes: row.estimated_duration_minutes,
    isActive: row.is_active,
  };
}

export class RoutesRepository {
  async listActive(): Promise<Route[]> {
    const result = await query<RouteRow>(
      `SELECT id, route_code, route_name, start_location, end_location, total_distance_km, estimated_duration_minutes, is_active
       FROM routes
       WHERE is_active = true
       ORDER BY route_code ASC`,
    );
    return result.rows.map(mapRoute);
  }
}
