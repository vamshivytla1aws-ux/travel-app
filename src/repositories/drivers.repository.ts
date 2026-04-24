import { query } from "@/lib/db";
import { Driver } from "@/lib/types";

type DriverRow = {
  id: number;
  full_name: string;
  phone: string;
  company_name: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  pf_account_number: string | null;
  uan_number: string | null;
  esic_number: string | null;
  license_number: string;
  license_expiry: string;
  experience_years: number;
  has_profile_photo: boolean;
  is_active: boolean;
};

function mapDriver(row: DriverRow): Driver {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    companyName: row.company_name,
    bankName: row.bank_name,
    bankAccountNumber: row.bank_account_number,
    bankIfsc: row.bank_ifsc,
    pfAccountNumber: row.pf_account_number,
    uanNumber: row.uan_number,
    esicNumber: row.esic_number,
    licenseNumber: row.license_number,
    licenseExpiry: row.license_expiry,
    experienceYears: row.experience_years,
    hasProfilePhoto: row.has_profile_photo,
    isActive: row.is_active,
  };
}

export class DriversRepository {
  async list(): Promise<Driver[]> {
    const result = await query<DriverRow>(
      `SELECT id, full_name, phone, company_name, bank_name, bank_account_number, bank_ifsc, pf_account_number, uan_number, esic_number,
              license_number, license_expiry, experience_years,
              (profile_photo_data IS NOT NULL) as has_profile_photo,
              is_active
       FROM drivers
       WHERE is_active = true
       ORDER BY full_name ASC`,
    );
    return result.rows.map(mapDriver);
  }
}
