export type BusStatus = "active" | "maintenance" | "inactive";
export type AssignmentStatus =
  | "scheduled"
  | "in_transit"
  | "completed"
  | "cancelled";

export interface Bus {
  id: number;
  busNumber: string;
  registrationNumber: string;
  make: string;
  model: string;
  seater: number;
  odometerKm: number;
  previousDayMileageKmpl: number | null;
  status: BusStatus;
  lastServiceAt: string | null;
}

export interface Driver {
  id: number;
  fullName: string;
  phone: string;
  companyName: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  pfAccountNumber: string | null;
  uanNumber: string | null;
  licenseNumber: string;
  licenseExpiry: string;
  experienceYears: number;
  hasProfilePhoto: boolean;
  isActive: boolean;
}

export interface Employee {
  id: number;
  employeeCode: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  gender: string | null;
  bloodGroup: string | null;
  validFrom: string | null;
  validTo: string | null;
  hasProfilePhoto: boolean;
  department: string;
  shiftStart: string;
  shiftEnd: string;
  pickupAddress: string;
  dropAddress: string;
  isActive: boolean;
}

export interface Route {
  id: number;
  routeCode: string;
  routeName: string;
  startLocation: string;
  endLocation: string;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  isActive: boolean;
}

export interface FuelEntry {
  id: number;
  busId: number;
  driverId: number | null;
  filledAt: string;
  odometerBeforeKm: number;
  odometerAfterKm: number;
  liters: number;
  amount: number;
  fuelStation: string | null;
  companyName: string | null;
}

export interface FuelTruck {
  id: number;
  truckCode: string;
  truckName: string;
  registrationNumber: string;
  tankCapacityLiters: number;
  currentAvailableLiters: number;
  lowStockThresholdLiters: number;
  status: "active" | "inactive";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FuelTruckRefill {
  id: number;
  fuelTruckId: number;
  refillDate: string;
  refillTime: string;
  odometerReading: number | null;
  fuelStationName: string | null;
  vendorName: string | null;
  quantityLiters: number;
  ratePerLiter: number;
  totalAmount: number;
  billNumber: string | null;
  paymentMode: string | null;
  driverName: string | null;
  notes: string | null;
  receiptFileName: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface FuelIssue {
  id: number;
  fuelTruckId: number;
  busId: number;
  busNumber: string | null;
  registrationNumber: string | null;
  issueDate: string;
  issueTime: string;
  litersIssued: number;
  odometerBeforeKm: number | null;
  odometerAfterKm: number | null;
  amount: number;
  companyName: string | null;
  issuedByName: string | null;
  busDriverName: string | null;
  routeReference: string | null;
  remarks: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface BusFuelHistoryItem {
  source: "TANKER" | "MANUAL";
  id: number;
  referenceId: number;
  fuelTruckId: number | null;
  busId: number;
  filledAt: string;
  issueDate: string | null;
  issueTime: string | null;
  odometerBeforeKm: number | null;
  odometerAfterKm: number | null;
  liters: number;
  amount: number;
  companyName: string | null;
  fuelStation: string | null;
}

export interface FuelTruckLedgerEntry {
  id: number;
  fuelTruckId: number;
  transactionType: "REFILL" | "ISSUE" | "ADJUSTMENT";
  referenceId: number | null;
  referenceType: string | null;
  transactionDate: string;
  transactionTime: string;
  openingStock: number;
  quantityIn: number;
  quantityOut: number;
  closingStock: number;
  remarks: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface FinanceLoan {
  id: number;
  registrationNo: string;
  vehicleTypeOrBusName: string;
  purchaseDate: string;
  vendorDealer: string | null;
  financierBankName: string;
  loanAccountNumber: string;
  loanType: string | null;
  interestRate: number;
  totalBusCost: number;
  downPayment: number;
  loanAmountTaken: number;
  processingFee: number;
  insuranceAmountFinanced: number;
  emiAmount: number;
  loanStartDate: string;
  loanEndDate: string;
  totalTenureMonths: number;
  monthsPaid: number;
  monthsLeft: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  nextEmiDate: string | null;
  status: "active" | "closed" | "overdue" | "repossessed";
  createdAt: string;
  updatedAt: string;
}
