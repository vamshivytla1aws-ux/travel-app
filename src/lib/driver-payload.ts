export type DriverCorePayload = {
  fullName: string;
  phone: string;
  companyName: string | null;
  licenseNumber: string;
  licenseExpiry: string;
  experienceYears: number;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  pfAccountNumber: string | null;
  uanNumber: string | null;
  esicNumber: string | null;
};

export type DriverProfilePayload = {
  bloodGroup: string | null;
  fatherName: string | null;
  fatherContact: string | null;
  motherName: string | null;
  motherContact: string | null;
  spouseName: string | null;
  spouseContact: string | null;
  child1Name: string | null;
  child2Name: string | null;
  panOrVoterId: string | null;
  aadhaarNo: string | null;
  vehicleBusId: number | null;
  vehicleRegistrationNo: string | null;
  presentReadingKm: number | null;
  badgeNo: string | null;
  badgeValidity: string | null;
  education: string | null;
  dateOfBirth: string | null;
  maritalStatus: string | null;
  religion: string | null;
  presentVillage: string | null;
  presentLandmark: string | null;
  presentPostOffice: string | null;
  presentMandal: string | null;
  presentPoliceStation: string | null;
  presentDistrict: string | null;
  presentState: string | null;
  presentPinCode: string | null;
  permanentVillage: string | null;
  permanentLandmark: string | null;
  permanentPostOffice: string | null;
  permanentMandal: string | null;
  permanentPoliceStation: string | null;
  permanentDistrict: string | null;
  permanentState: string | null;
  permanentPinCode: string | null;
  reference1Name: string | null;
  reference1Relationship: string | null;
  reference1Contact: string | null;
  reference2Name: string | null;
  reference2Relationship: string | null;
  reference2Contact: string | null;
  presentSalary: number | null;
  salaryExpectation: number | null;
  salaryOffered: number | null;
  joiningDate: string | null;
  candidateSignatureText: string | null;
  candidateSignatureDate: string | null;
  appointeeSignatureText: string | null;
  approvalAuthoritySignatureText: string | null;
};

type SourceValue = string | number | null | undefined;
type Source = {
  get: (key: string) => SourceValue;
};

function cleanText(value: SourceValue) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function cleanRequiredText(value: SourceValue) {
  return String(value ?? "").trim();
}

function cleanNumber(value: SourceValue) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanInteger(value: SourceValue, fallback = 0) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function cleanDate(value: SourceValue) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function readDriverPayload(source: Source): {
  core: DriverCorePayload;
  profile: DriverProfilePayload;
} {
  return {
    core: {
      fullName: cleanRequiredText(source.get("fullName")),
      phone: cleanRequiredText(source.get("phone")),
      companyName: cleanText(source.get("companyName")),
      licenseNumber: cleanRequiredText(source.get("licenseNumber")),
      licenseExpiry: cleanRequiredText(source.get("licenseExpiry")),
      experienceYears: cleanInteger(source.get("experienceYears"), 0),
      bankName: cleanText(source.get("bankName")),
      bankAccountNumber: cleanText(source.get("bankAccountNumber")),
      bankIfsc: cleanText(source.get("bankIfsc")),
      pfAccountNumber: cleanText(source.get("pfAccountNumber")),
      uanNumber: cleanText(source.get("uanNumber")),
      esicNumber: cleanText(source.get("esicNumber")),
    },
    profile: {
      bloodGroup: cleanText(source.get("bloodGroup")),
      fatherName: cleanText(source.get("fatherName")),
      fatherContact: cleanText(source.get("fatherContact")),
      motherName: cleanText(source.get("motherName")),
      motherContact: cleanText(source.get("motherContact")),
      spouseName: cleanText(source.get("spouseName")),
      spouseContact: cleanText(source.get("spouseContact")),
      child1Name: cleanText(source.get("child1Name")),
      child2Name: cleanText(source.get("child2Name")),
      panOrVoterId: cleanText(source.get("panOrVoterId")),
      aadhaarNo: cleanText(source.get("aadhaarNo")),
      vehicleBusId: cleanInteger(source.get("vehicleBusId"), 0) || null,
      vehicleRegistrationNo: cleanText(source.get("vehicleRegistrationNo")),
      presentReadingKm: cleanNumber(source.get("presentReadingKm")),
      badgeNo: cleanText(source.get("badgeNo")),
      badgeValidity: cleanDate(source.get("badgeValidity")),
      education: cleanText(source.get("education")),
      dateOfBirth: cleanDate(source.get("dateOfBirth")),
      maritalStatus: cleanText(source.get("maritalStatus")),
      religion: cleanText(source.get("religion")),
      presentVillage: cleanText(source.get("presentVillage")),
      presentLandmark: cleanText(source.get("presentLandmark")),
      presentPostOffice: cleanText(source.get("presentPostOffice")),
      presentMandal: cleanText(source.get("presentMandal")),
      presentPoliceStation: cleanText(source.get("presentPoliceStation")),
      presentDistrict: cleanText(source.get("presentDistrict")),
      presentState: cleanText(source.get("presentState")),
      presentPinCode: cleanText(source.get("presentPinCode")),
      permanentVillage: cleanText(source.get("permanentVillage")),
      permanentLandmark: cleanText(source.get("permanentLandmark")),
      permanentPostOffice: cleanText(source.get("permanentPostOffice")),
      permanentMandal: cleanText(source.get("permanentMandal")),
      permanentPoliceStation: cleanText(source.get("permanentPoliceStation")),
      permanentDistrict: cleanText(source.get("permanentDistrict")),
      permanentState: cleanText(source.get("permanentState")),
      permanentPinCode: cleanText(source.get("permanentPinCode")),
      reference1Name: cleanText(source.get("reference1Name")),
      reference1Relationship: cleanText(source.get("reference1Relationship")),
      reference1Contact: cleanText(source.get("reference1Contact")),
      reference2Name: cleanText(source.get("reference2Name")),
      reference2Relationship: cleanText(source.get("reference2Relationship")),
      reference2Contact: cleanText(source.get("reference2Contact")),
      presentSalary: cleanNumber(source.get("presentSalary")),
      salaryExpectation: cleanNumber(source.get("salaryExpectation")),
      salaryOffered: cleanNumber(source.get("salaryOffered")),
      joiningDate: cleanDate(source.get("joiningDate")),
      candidateSignatureText: cleanText(source.get("candidateSignatureText")),
      candidateSignatureDate: cleanDate(source.get("candidateSignatureDate")),
      appointeeSignatureText: cleanText(source.get("appointeeSignatureText")),
      approvalAuthoritySignatureText: cleanText(source.get("approvalAuthoritySignatureText")),
    },
  };
}

export function validateDriverCore(core: DriverCorePayload, profile: DriverProfilePayload) {
  if (!core.fullName || !core.phone || !core.licenseNumber || !core.licenseExpiry || !profile.joiningDate) {
    return "missing_required";
  }
  if (!/^\d{10,15}$/.test(core.phone)) return "invalid_phone";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(core.licenseExpiry)) return "invalid_license_expiry";
  return null;
}
