export type ExportModuleKey =
  | "overall"
  | "buses"
  | "drivers"
  | "employees"
  | "routes"
  | "trips"
  | "tracking"
  | "fuel-trucks"
  | "finance"
  | "logs"
  | "users";

export type ExportField = { key: string; label: string };

export const MODULE_EXPORT_FIELDS: Record<ExportModuleKey, ExportField[]> = {
  overall: [
    { key: "module", label: "Module" },
    { key: "total_records", label: "Total Records" },
    { key: "active_records", label: "Active Records" },
    { key: "last_updated", label: "Last Updated" },
  ],
  buses: [
    { key: "bus_number", label: "Bus Number" },
    { key: "registration_number", label: "Registration" },
    { key: "make", label: "Make" },
    { key: "model", label: "Model" },
    { key: "seater", label: "Seater" },
    { key: "status", label: "Status" },
    { key: "odometer_km", label: "Odometer (km)" },
  ],
  drivers: [
    { key: "full_name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "company_name", label: "Company" },
    { key: "license_number", label: "License" },
    { key: "is_active", label: "Active" },
  ],
  employees: [
    { key: "employee_code", label: "Employee Code" },
    { key: "full_name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "department", label: "Department" },
    { key: "company_name", label: "Company" },
    { key: "is_active", label: "Active" },
  ],
  routes: [
    { key: "assignment_date", label: "Date" },
    { key: "route_name", label: "Route" },
    { key: "shift", label: "Shift" },
    { key: "company_name", label: "Company" },
    { key: "bus_registration_number", label: "Registration" },
    { key: "driver_name", label: "Driver" },
  ],
  trips: [
    { key: "trip_date", label: "Date" },
    { key: "status", label: "Status" },
    { key: "bus_number", label: "Bus" },
    { key: "driver_name", label: "Driver" },
    { key: "route_name", label: "Route" },
    { key: "shift_label", label: "Shift" },
    { key: "km_run", label: "KM Run" },
    { key: "mileage_kmpl", label: "Mileage" },
  ],
  tracking: [
    { key: "logged_at", label: "Logged At" },
    { key: "bus_number", label: "Bus" },
    { key: "latitude", label: "Latitude" },
    { key: "longitude", label: "Longitude" },
    { key: "speed_kmph", label: "Speed" },
  ],
  "fuel-trucks": [
    { key: "issue_date", label: "Issue Date" },
    { key: "truck_code", label: "Truck" },
    { key: "registration_number", label: "Registration" },
    { key: "liters_issued", label: "Liters Issued" },
    { key: "amount", label: "Amount" },
    { key: "company_name", label: "Company" },
  ],
  finance: [
    { key: "registration_no", label: "Registration" },
    { key: "vehicle_type_or_bus_name", label: "Vehicle" },
    { key: "financier_bank_name", label: "Financier" },
    { key: "loan_amount_taken", label: "Loan Amount" },
    { key: "emi_amount", label: "EMI" },
    { key: "outstanding_principal", label: "Outstanding Principal" },
    { key: "status", label: "Status" },
  ],
  logs: [
    { key: "created_at", label: "Time" },
    { key: "user_email", label: "User" },
    { key: "action", label: "Action" },
    { key: "entity_type", label: "Entity Type" },
    { key: "entity_id", label: "Entity ID" },
  ],
  users: [
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    { key: "is_active", label: "Active" },
    { key: "updated_at", label: "Updated At" },
  ],
};

