import { NextRequest, NextResponse } from "next/server";
import { PoolClient } from "pg";
import { requireApiModuleAccess } from "@/lib/auth";
import { DriverProfilePayload, readDriverPayload, validateDriverCore } from "@/lib/driver-payload";
import { query, withTransaction } from "@/lib/db";
import { DriversService } from "@/services/drivers.service";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";

const driversService = new DriversService();

async function normalizeVehicleData(profile: DriverProfilePayload, client?: PoolClient) {
  if (!profile.vehicleBusId) {
    return {
      vehicleBusId: null,
      vehicleRegistrationNo: profile.vehicleRegistrationNo,
      presentReadingKm: profile.presentReadingKm,
    };
  }
  const busResult = client
    ? await client.query<{ registration_number: string; odometer_km: string }>(
        `SELECT registration_number, odometer_km::text FROM buses WHERE id = $1`,
        [profile.vehicleBusId],
      )
    : await query<{ registration_number: string; odometer_km: string }>(
        `SELECT registration_number, odometer_km::text FROM buses WHERE id = $1`,
        [profile.vehicleBusId],
      );
  const bus = busResult.rows[0];
  if (!bus) {
    return {
      vehicleBusId: null,
      vehicleRegistrationNo: profile.vehicleRegistrationNo,
      presentReadingKm: profile.presentReadingKm,
    };
  }
  return {
    vehicleBusId: profile.vehicleBusId,
    vehicleRegistrationNo: profile.vehicleRegistrationNo ?? bus.registration_number,
    presentReadingKm: profile.presentReadingKm ?? Number(bus.odometer_km),
  };
}

async function upsertDriverProfile(driverId: number, profile: DriverProfilePayload, client?: PoolClient) {
  const vehicle = await normalizeVehicleData(profile, client);
  const sql = `INSERT INTO driver_profiles(
      driver_id, blood_group, father_name, father_contact, mother_name, mother_contact, spouse_name, spouse_contact,
      child_1_name, child_2_name, pan_or_voter_id, aadhaar_no, vehicle_bus_id, vehicle_registration_no, present_reading_km,
      badge_no, badge_validity, education, date_of_birth, marital_status, religion,
      present_village, present_landmark, present_post_office, present_mandal, present_police_station, present_district,
      present_state, present_pin_code, permanent_village, permanent_landmark, permanent_post_office, permanent_mandal,
      permanent_police_station, permanent_district, permanent_state, permanent_pin_code,
      reference1_name, reference1_relationship, reference1_contact, reference2_name, reference2_relationship, reference2_contact,
      present_salary, salary_expectation, salary_offered, joining_date,
      candidate_signature_text, candidate_signature_date, appointee_signature_text, approval_authority_signature_text,
      updated_at
    )
    VALUES(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
      $16,$17,$18,$19,$20,$21,
      $22,$23,$24,$25,$26,$27,
      $28,$29,$30,$31,$32,$33,
      $34,$35,$36,$37,
      $38,$39,$40,$41,$42,$43,
      $44,$45,$46,$47,
      $48,$49,$50,$51,
      NOW()
    )
    ON CONFLICT (driver_id) DO UPDATE SET
      blood_group = EXCLUDED.blood_group,
      father_name = EXCLUDED.father_name,
      father_contact = EXCLUDED.father_contact,
      mother_name = EXCLUDED.mother_name,
      mother_contact = EXCLUDED.mother_contact,
      spouse_name = EXCLUDED.spouse_name,
      spouse_contact = EXCLUDED.spouse_contact,
      child_1_name = EXCLUDED.child_1_name,
      child_2_name = EXCLUDED.child_2_name,
      pan_or_voter_id = EXCLUDED.pan_or_voter_id,
      aadhaar_no = EXCLUDED.aadhaar_no,
      vehicle_bus_id = EXCLUDED.vehicle_bus_id,
      vehicle_registration_no = EXCLUDED.vehicle_registration_no,
      present_reading_km = EXCLUDED.present_reading_km,
      badge_no = EXCLUDED.badge_no,
      badge_validity = EXCLUDED.badge_validity,
      education = EXCLUDED.education,
      date_of_birth = EXCLUDED.date_of_birth,
      marital_status = EXCLUDED.marital_status,
      religion = EXCLUDED.religion,
      present_village = EXCLUDED.present_village,
      present_landmark = EXCLUDED.present_landmark,
      present_post_office = EXCLUDED.present_post_office,
      present_mandal = EXCLUDED.present_mandal,
      present_police_station = EXCLUDED.present_police_station,
      present_district = EXCLUDED.present_district,
      present_state = EXCLUDED.present_state,
      present_pin_code = EXCLUDED.present_pin_code,
      permanent_village = EXCLUDED.permanent_village,
      permanent_landmark = EXCLUDED.permanent_landmark,
      permanent_post_office = EXCLUDED.permanent_post_office,
      permanent_mandal = EXCLUDED.permanent_mandal,
      permanent_police_station = EXCLUDED.permanent_police_station,
      permanent_district = EXCLUDED.permanent_district,
      permanent_state = EXCLUDED.permanent_state,
      permanent_pin_code = EXCLUDED.permanent_pin_code,
      reference1_name = EXCLUDED.reference1_name,
      reference1_relationship = EXCLUDED.reference1_relationship,
      reference1_contact = EXCLUDED.reference1_contact,
      reference2_name = EXCLUDED.reference2_name,
      reference2_relationship = EXCLUDED.reference2_relationship,
      reference2_contact = EXCLUDED.reference2_contact,
      present_salary = EXCLUDED.present_salary,
      salary_expectation = EXCLUDED.salary_expectation,
      salary_offered = EXCLUDED.salary_offered,
      joining_date = EXCLUDED.joining_date,
      candidate_signature_text = EXCLUDED.candidate_signature_text,
      candidate_signature_date = EXCLUDED.candidate_signature_date,
      appointee_signature_text = EXCLUDED.appointee_signature_text,
      approval_authority_signature_text = EXCLUDED.approval_authority_signature_text,
      updated_at = NOW()`;
  const params = [
    driverId,
    profile.bloodGroup,
    profile.fatherName,
    profile.fatherContact,
    profile.motherName,
    profile.motherContact,
    profile.spouseName,
    profile.spouseContact,
    profile.child1Name,
    profile.child2Name,
    profile.panOrVoterId,
    profile.aadhaarNo,
    vehicle.vehicleBusId,
    vehicle.vehicleRegistrationNo,
    vehicle.presentReadingKm,
    profile.badgeNo,
    profile.badgeValidity,
    profile.education,
    profile.dateOfBirth,
    profile.maritalStatus,
    profile.religion,
    profile.presentVillage,
    profile.presentLandmark,
    profile.presentPostOffice,
    profile.presentMandal,
    profile.presentPoliceStation,
    profile.presentDistrict,
    profile.presentState,
    profile.presentPinCode,
    profile.permanentVillage,
    profile.permanentLandmark,
    profile.permanentPostOffice,
    profile.permanentMandal,
    profile.permanentPoliceStation,
    profile.permanentDistrict,
    profile.permanentState,
    profile.permanentPinCode,
    profile.reference1Name,
    profile.reference1Relationship,
    profile.reference1Contact,
    profile.reference2Name,
    profile.reference2Relationship,
    profile.reference2Contact,
    profile.presentSalary,
    profile.salaryExpectation,
    profile.salaryOffered,
    profile.joiningDate,
    profile.candidateSignatureText,
    profile.candidateSignatureDate,
    profile.appointeeSignatureText,
    profile.approvalAuthoritySignatureText,
  ];
  if (client) {
    await client.query(sql, params);
    return;
  }
  await query(sql, params);
}

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("drivers");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = String(request.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
  const company = String(request.nextUrl.searchParams.get("company") ?? "").trim().toLowerCase();
  const data = await driversService.listDrivers();
  const filtered = data.filter((driver) => {
    const matchesSearch =
      !q ||
      driver.fullName.toLowerCase().includes(q) ||
      driver.phone.toLowerCase().includes(q) ||
      driver.licenseNumber.toLowerCase().includes(q);
    const matchesCompany = !company || (driver.companyName ?? "").trim().toLowerCase() === company;
    return matchesSearch && matchesCompany;
  });
  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("drivers");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await ensureTransportEnhancements();

  const body = await request.json().catch(() => null);
  const payload = readDriverPayload({ get: (key) => (body as Record<string, unknown>)?.[key] as string | null });
  const validation = validateDriverCore(payload.core, payload.profile);
  if (validation) {
    return NextResponse.json({ error: validation }, { status: 400 });
  }

  const existing = await query<{ id: number }>(
    `SELECT id FROM drivers WHERE phone = $1 OR license_number = $2 LIMIT 1`,
    [payload.core.phone, payload.core.licenseNumber],
  );
  if ((existing.rowCount ?? 0) > 0) {
    return NextResponse.json({ error: "Duplicate driver" }, { status: 409 });
  }

  try {
    const createdId = await withTransaction(async (client) => {
      const result = await client.query<{ id: number }>(
        `INSERT INTO drivers(
          full_name, phone, company_name, bank_name, bank_account_number, bank_ifsc, pf_account_number, uan_number,
          license_number, license_expiry, experience_years
        )
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          payload.core.fullName,
          payload.core.phone,
          payload.core.companyName,
          payload.core.bankName,
          payload.core.bankAccountNumber,
          payload.core.bankIfsc,
          payload.core.pfAccountNumber,
          payload.core.uanNumber,
          payload.core.licenseNumber,
          payload.core.licenseExpiry,
          payload.core.experienceYears,
        ],
      );
      await upsertDriverProfile(result.rows[0].id, payload.profile, client);
      return result.rows[0].id;
    });
    return NextResponse.json({ id: createdId }, { status: 201 });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError?.code === "23505") {
      return NextResponse.json({ error: "Duplicate profile identity" }, { status: 409 });
    }
    throw error;
  }
}
