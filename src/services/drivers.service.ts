import { ensureDocumentTables } from "@/lib/document-storage";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { DriversRepository } from "@/repositories/drivers.repository";

const driversRepository = new DriversRepository();

export class DriversService {
  async listDrivers() {
    await ensureTransportEnhancements();
    return driversRepository.list();
  }

  async getDriverProfile(id: number) {
    await ensureTransportEnhancements();
    await ensureDocumentTables();
    const driverResult = await query<{
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
    }>(
      `SELECT id, full_name, phone, company_name, bank_name, bank_account_number, bank_ifsc, pf_account_number, uan_number, esic_number,
              license_number, license_expiry::text, experience_years, (profile_photo_data IS NOT NULL) as has_profile_photo, is_active
       FROM drivers
       WHERE id = $1`,
      [id],
    );

    const driver = driverResult.rows[0];
    if (!driver) return null;

    const documents = await query<{
      id: number;
      document_type: string;
      document_name: string;
      file_name: string | null;
      mime_type: string | null;
      file_size_bytes: number | null;
      uploaded_at: string;
    }>(
      `SELECT id, document_type, document_name, file_name, mime_type, file_size_bytes, uploaded_at::text
       FROM driver_documents
       WHERE driver_id = $1
       ORDER BY uploaded_at DESC`,
      [id],
    );

    const routeAssignments = await query<{
      id: number;
      assignment_date: string;
      route_name: string;
      shift: string;
      company_name: string | null;
      bus_registration_number: string;
    }>(
      `SELECT
          rp.id,
          rp.assignment_date::text,
          rp.route_name,
          rp.shift::text,
          rp.company_name,
          b.registration_number as bus_registration_number
       FROM route_planner_entries rp
       JOIN buses b ON b.id = rp.bus_id
       WHERE rp.driver_id = $1 AND rp.is_active = true
       ORDER BY rp.assignment_date DESC, rp.id DESC
       LIMIT 25`,
      [id],
    );

    const profileResult = await query<{
      driver_id: number;
      blood_group: string | null;
      father_name: string | null;
      father_contact: string | null;
      mother_name: string | null;
      mother_contact: string | null;
      spouse_name: string | null;
      spouse_contact: string | null;
      child_1_name: string | null;
      child_2_name: string | null;
      pan_or_voter_id: string | null;
      aadhaar_no: string | null;
      vehicle_bus_id: number | null;
      vehicle_registration_no: string | null;
      present_reading_km: string | null;
      badge_no: string | null;
      badge_validity: string | null;
      education: string | null;
      date_of_birth: string | null;
      marital_status: string | null;
      religion: string | null;
      present_village: string | null;
      present_landmark: string | null;
      present_post_office: string | null;
      present_mandal: string | null;
      present_police_station: string | null;
      present_district: string | null;
      present_state: string | null;
      present_pin_code: string | null;
      permanent_village: string | null;
      permanent_landmark: string | null;
      permanent_post_office: string | null;
      permanent_mandal: string | null;
      permanent_police_station: string | null;
      permanent_district: string | null;
      permanent_state: string | null;
      permanent_pin_code: string | null;
      reference1_name: string | null;
      reference1_relationship: string | null;
      reference1_contact: string | null;
      reference2_name: string | null;
      reference2_relationship: string | null;
      reference2_contact: string | null;
      present_salary: string | null;
      salary_expectation: string | null;
      salary_offered: string | null;
      joining_date: string | null;
      candidate_signature_text: string | null;
      candidate_signature_date: string | null;
      appointee_signature_text: string | null;
      approval_authority_signature_text: string | null;
    }>(
      `SELECT driver_id, blood_group, father_name, father_contact, mother_name, mother_contact, spouse_name, spouse_contact,
              child_1_name, child_2_name, pan_or_voter_id, aadhaar_no, vehicle_bus_id, vehicle_registration_no,
              present_reading_km::text, badge_no, badge_validity::text, education, date_of_birth::text, marital_status, religion,
              present_village, present_landmark, present_post_office, present_mandal, present_police_station, present_district,
              present_state, present_pin_code, permanent_village, permanent_landmark, permanent_post_office, permanent_mandal,
              permanent_police_station, permanent_district, permanent_state, permanent_pin_code, reference1_name,
              reference1_relationship, reference1_contact, reference2_name, reference2_relationship, reference2_contact,
              present_salary::text, salary_expectation::text, salary_offered::text, joining_date::text,
              candidate_signature_text, candidate_signature_date::text, appointee_signature_text, approval_authority_signature_text
       FROM driver_profiles
       WHERE driver_id = $1`,
      [id],
    );
    const profileRow = profileResult.rows[0];

    return {
      driver,
      profile: profileRow
        ? {
            driverId: profileRow.driver_id,
            bloodGroup: profileRow.blood_group,
            fatherName: profileRow.father_name,
            fatherContact: profileRow.father_contact,
            motherName: profileRow.mother_name,
            motherContact: profileRow.mother_contact,
            spouseName: profileRow.spouse_name,
            spouseContact: profileRow.spouse_contact,
            child1Name: profileRow.child_1_name,
            child2Name: profileRow.child_2_name,
            panOrVoterId: profileRow.pan_or_voter_id,
            aadhaarNo: profileRow.aadhaar_no,
            vehicleBusId: profileRow.vehicle_bus_id,
            vehicleRegistrationNo: profileRow.vehicle_registration_no,
            presentReadingKm: profileRow.present_reading_km != null ? Number(profileRow.present_reading_km) : null,
            badgeNo: profileRow.badge_no,
            badgeValidity: profileRow.badge_validity,
            education: profileRow.education,
            dateOfBirth: profileRow.date_of_birth,
            maritalStatus: profileRow.marital_status,
            religion: profileRow.religion,
            presentVillage: profileRow.present_village,
            presentLandmark: profileRow.present_landmark,
            presentPostOffice: profileRow.present_post_office,
            presentMandal: profileRow.present_mandal,
            presentPoliceStation: profileRow.present_police_station,
            presentDistrict: profileRow.present_district,
            presentState: profileRow.present_state,
            presentPinCode: profileRow.present_pin_code,
            permanentVillage: profileRow.permanent_village,
            permanentLandmark: profileRow.permanent_landmark,
            permanentPostOffice: profileRow.permanent_post_office,
            permanentMandal: profileRow.permanent_mandal,
            permanentPoliceStation: profileRow.permanent_police_station,
            permanentDistrict: profileRow.permanent_district,
            permanentState: profileRow.permanent_state,
            permanentPinCode: profileRow.permanent_pin_code,
            reference1Name: profileRow.reference1_name,
            reference1Relationship: profileRow.reference1_relationship,
            reference1Contact: profileRow.reference1_contact,
            reference2Name: profileRow.reference2_name,
            reference2Relationship: profileRow.reference2_relationship,
            reference2Contact: profileRow.reference2_contact,
            presentSalary: profileRow.present_salary != null ? Number(profileRow.present_salary) : null,
            salaryExpectation: profileRow.salary_expectation != null ? Number(profileRow.salary_expectation) : null,
            salaryOffered: profileRow.salary_offered != null ? Number(profileRow.salary_offered) : null,
            joiningDate: profileRow.joining_date,
            candidateSignatureText: profileRow.candidate_signature_text,
            candidateSignatureDate: profileRow.candidate_signature_date,
            appointeeSignatureText: profileRow.appointee_signature_text,
            approvalAuthoritySignatureText: profileRow.approval_authority_signature_text,
          }
        : null,
      documents: documents.rows,
      routeAssignments: routeAssignments.rows,
    };
  }
}
