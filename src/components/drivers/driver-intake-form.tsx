import { BusSearchSelect } from "@/components/fuel-trucks/bus-search-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BusOption = {
  id: number;
  busNumber: string;
  registrationNumber: string;
  latestOdometerKm: number | null;
};

type DriverCoreValues = {
  fullName: string;
  phone: string;
  companyName: string;
  licenseNumber: string;
  licenseExpiry: string;
  experienceYears: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  pfAccountNumber: string;
  uanNumber: string;
};

type DriverProfileValues = {
  bloodGroup: string;
  fatherName: string;
  fatherContact: string;
  motherName: string;
  motherContact: string;
  spouseName: string;
  spouseContact: string;
  child1Name: string;
  child2Name: string;
  panOrVoterId: string;
  aadhaarNo: string;
  vehicleBusId: string;
  vehicleRegistrationNo: string;
  presentReadingKm: string;
  badgeNo: string;
  badgeValidity: string;
  education: string;
  dateOfBirth: string;
  maritalStatus: string;
  religion: string;
  presentVillage: string;
  presentLandmark: string;
  presentPostOffice: string;
  presentMandal: string;
  presentPoliceStation: string;
  presentDistrict: string;
  presentState: string;
  presentPinCode: string;
  permanentVillage: string;
  permanentLandmark: string;
  permanentPostOffice: string;
  permanentMandal: string;
  permanentPoliceStation: string;
  permanentDistrict: string;
  permanentState: string;
  permanentPinCode: string;
  reference1Name: string;
  reference1Relationship: string;
  reference1Contact: string;
  reference2Name: string;
  reference2Relationship: string;
  reference2Contact: string;
  presentSalary: string;
  salaryExpectation: string;
  salaryOffered: string;
  joiningDate: string;
  candidateSignatureText: string;
  candidateSignatureDate: string;
  appointeeSignatureText: string;
  approvalAuthoritySignatureText: string;
};

export type DriverIntakeDefaults = DriverCoreValues & DriverProfileValues;

type Props = {
  defaults: DriverIntakeDefaults;
  buses: BusOption[];
  submitLabel: string;
};

function sectionTitle(title: string) {
  return <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>;
}

export function DriverIntakeForm({ defaults, buses, submitLabel }: Props) {
  const selectedBus = buses.find((bus) => String(bus.id) === defaults.vehicleBusId);
  const odometerDefault =
    defaults.presentReadingKm ||
    (selectedBus?.latestOdometerKm != null ? String(selectedBus.latestOdometerKm) : "");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
        {sectionTitle("Basic")}
        <div className="grid gap-1">
          <Label htmlFor="fullName">Driver Name</Label>
          <Input id="fullName" name="fullName" defaultValue={defaults.fullName} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="phone">Contact No</Label>
          <Input id="phone" name="phone" defaultValue={defaults.phone} pattern="[0-9]{10,15}" required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="bloodGroup">Blood Group</Label>
          <Input id="bloodGroup" name="bloodGroup" defaultValue={defaults.bloodGroup} />
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
        {sectionTitle("Family Details")}
        <div className="grid gap-1"><Label htmlFor="fatherName">Father’s Name</Label><Input id="fatherName" name="fatherName" defaultValue={defaults.fatherName} /></div>
        <div className="grid gap-1"><Label htmlFor="fatherContact">Contact Number (Father)</Label><Input id="fatherContact" name="fatherContact" defaultValue={defaults.fatherContact} /></div>
        <div className="grid gap-1"><Label htmlFor="motherName">Mother’s Name</Label><Input id="motherName" name="motherName" defaultValue={defaults.motherName} /></div>
        <div className="grid gap-1"><Label htmlFor="motherContact">Contact Number (Mother)</Label><Input id="motherContact" name="motherContact" defaultValue={defaults.motherContact} /></div>
        <div className="grid gap-1"><Label htmlFor="spouseName">Spouse Name</Label><Input id="spouseName" name="spouseName" defaultValue={defaults.spouseName} /></div>
        <div className="grid gap-1"><Label htmlFor="spouseContact">Contact Number (Spouse)</Label><Input id="spouseContact" name="spouseContact" defaultValue={defaults.spouseContact} /></div>
        <div className="grid gap-1"><Label htmlFor="child1Name">Children’s (1)</Label><Input id="child1Name" name="child1Name" defaultValue={defaults.child1Name} /></div>
        <div className="grid gap-1"><Label htmlFor="child2Name">Children’s (2)</Label><Input id="child2Name" name="child2Name" defaultValue={defaults.child2Name} /></div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
        {sectionTitle("Identity & Banking")}
        <div className="grid gap-1"><Label htmlFor="panOrVoterId">PAN Card No / Voter ID</Label><Input id="panOrVoterId" name="panOrVoterId" defaultValue={defaults.panOrVoterId} /></div>
        <div className="grid gap-1"><Label htmlFor="aadhaarNo">Aadhaar No</Label><Input id="aadhaarNo" name="aadhaarNo" defaultValue={defaults.aadhaarNo} /></div>
        <div className="grid gap-1"><Label htmlFor="bankAccountNumber">Bank Account No</Label><Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={defaults.bankAccountNumber} /></div>
        <div className="grid gap-1"><Label htmlFor="bankName">Name of the Bank</Label><Input id="bankName" name="bankName" defaultValue={defaults.bankName} /></div>
        <div className="grid gap-1"><Label htmlFor="bankIfsc">IFSC No</Label><Input id="bankIfsc" name="bankIfsc" defaultValue={defaults.bankIfsc} /></div>
        <div className="grid gap-1"><Label htmlFor="pfAccountNumber">PF Account No</Label><Input id="pfAccountNumber" name="pfAccountNumber" defaultValue={defaults.pfAccountNumber} /></div>
        <div className="grid gap-1"><Label htmlFor="uanNumber">UAN No</Label><Input id="uanNumber" name="uanNumber" defaultValue={defaults.uanNumber} /></div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
        {sectionTitle("Vehicle & License")}
        <div className="grid gap-1 md:col-span-2">
          <Label htmlFor="vehicleBusId">Vehicles No (Select from buses)</Label>
          <BusSearchSelect
            id="vehicleBusId"
            name="vehicleBusId"
            required={false}
            buses={buses}
            oldOdometerTargetId="presentReadingKm"
            registrationTargetId="vehicleRegistrationNo"
            defaultSelectedId={defaults.vehicleBusId ? Number(defaults.vehicleBusId) : null}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="vehicleRegistrationNo">Vehicle Registration</Label>
          <Input id="vehicleRegistrationNo" name="vehicleRegistrationNo" defaultValue={defaults.vehicleRegistrationNo} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="presentReadingKm">Present Reading</Label>
          <Input id="presentReadingKm" name="presentReadingKm" type="number" step="0.01" min={0} defaultValue={odometerDefault} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="licenseNumber">Driving License No</Label>
          <Input id="licenseNumber" name="licenseNumber" defaultValue={defaults.licenseNumber} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="licenseExpiry">Validity (DL)</Label>
          <Input id="licenseExpiry" name="licenseExpiry" type="date" defaultValue={defaults.licenseExpiry} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="badgeNo">Badge No</Label>
          <Input id="badgeNo" name="badgeNo" defaultValue={defaults.badgeNo} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="badgeValidity">Validity (Badge)</Label>
          <Input id="badgeValidity" name="badgeValidity" type="date" defaultValue={defaults.badgeValidity} />
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
        {sectionTitle("Education & Personal Info")}
        <div className="grid gap-1"><Label htmlFor="education">Education</Label><Input id="education" name="education" defaultValue={defaults.education} /></div>
        <div className="grid gap-1"><Label htmlFor="experienceYears">Experience</Label><Input id="experienceYears" name="experienceYears" type="number" min={0} step="0.1" defaultValue={defaults.experienceYears} /></div>
        <div className="grid gap-1"><Label htmlFor="dateOfBirth">Date of Birth</Label><Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={defaults.dateOfBirth} /></div>
        <div className="grid gap-1"><Label htmlFor="maritalStatus">Marital Status</Label><Input id="maritalStatus" name="maritalStatus" defaultValue={defaults.maritalStatus} /></div>
        <div className="grid gap-1"><Label htmlFor="religion">Religion</Label><Input id="religion" name="religion" defaultValue={defaults.religion} /></div>
        <div className="grid gap-1"><Label htmlFor="companyName">Company</Label><Input id="companyName" name="companyName" defaultValue={defaults.companyName} /></div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
        {sectionTitle("Present Address")}
        <div className="grid gap-1"><Label htmlFor="presentVillage">Village</Label><Input id="presentVillage" name="presentVillage" defaultValue={defaults.presentVillage} /></div>
        <div className="grid gap-1"><Label htmlFor="presentLandmark">Land Mark</Label><Input id="presentLandmark" name="presentLandmark" defaultValue={defaults.presentLandmark} /></div>
        <div className="grid gap-1"><Label htmlFor="presentPostOffice">Post Office</Label><Input id="presentPostOffice" name="presentPostOffice" defaultValue={defaults.presentPostOffice} /></div>
        <div className="grid gap-1"><Label htmlFor="presentMandal">Mandal</Label><Input id="presentMandal" name="presentMandal" defaultValue={defaults.presentMandal} /></div>
        <div className="grid gap-1"><Label htmlFor="presentPoliceStation">Police Station</Label><Input id="presentPoliceStation" name="presentPoliceStation" defaultValue={defaults.presentPoliceStation} /></div>
        <div className="grid gap-1"><Label htmlFor="presentDistrict">District</Label><Input id="presentDistrict" name="presentDistrict" defaultValue={defaults.presentDistrict} /></div>
        <div className="grid gap-1"><Label htmlFor="presentState">State</Label><Input id="presentState" name="presentState" defaultValue={defaults.presentState} /></div>
        <div className="grid gap-1"><Label htmlFor="presentPinCode">Pin Code No</Label><Input id="presentPinCode" name="presentPinCode" defaultValue={defaults.presentPinCode} /></div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
        {sectionTitle("Permanent Address")}
        <div className="grid gap-1"><Label htmlFor="permanentVillage">Village</Label><Input id="permanentVillage" name="permanentVillage" defaultValue={defaults.permanentVillage} /></div>
        <div className="grid gap-1"><Label htmlFor="permanentLandmark">Land Mark</Label><Input id="permanentLandmark" name="permanentLandmark" defaultValue={defaults.permanentLandmark} /></div>
        <div className="grid gap-1"><Label htmlFor="permanentPostOffice">Post Office</Label><Input id="permanentPostOffice" name="permanentPostOffice" defaultValue={defaults.permanentPostOffice} /></div>
        <div className="grid gap-1"><Label htmlFor="permanentMandal">Mandal</Label><Input id="permanentMandal" name="permanentMandal" defaultValue={defaults.permanentMandal} /></div>
        <div className="grid gap-1"><Label htmlFor="permanentPoliceStation">Police Station</Label><Input id="permanentPoliceStation" name="permanentPoliceStation" defaultValue={defaults.permanentPoliceStation} /></div>
        <div className="grid gap-1"><Label htmlFor="permanentDistrict">District</Label><Input id="permanentDistrict" name="permanentDistrict" defaultValue={defaults.permanentDistrict} /></div>
        <div className="grid gap-1"><Label htmlFor="permanentState">State</Label><Input id="permanentState" name="permanentState" defaultValue={defaults.permanentState} /></div>
        <div className="grid gap-1"><Label htmlFor="permanentPinCode">Pin Code No</Label><Input id="permanentPinCode" name="permanentPinCode" defaultValue={defaults.permanentPinCode} /></div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
        {sectionTitle("Reference Details")}
        <div className="grid gap-1"><Label htmlFor="reference1Name">Reference 1 – Person Name</Label><Input id="reference1Name" name="reference1Name" defaultValue={defaults.reference1Name} /></div>
        <div className="grid gap-1"><Label htmlFor="reference1Relationship">Relationship with Person (Ref 1)</Label><Input id="reference1Relationship" name="reference1Relationship" defaultValue={defaults.reference1Relationship} /></div>
        <div className="grid gap-1"><Label htmlFor="reference1Contact">Contact No (Ref 1)</Label><Input id="reference1Contact" name="reference1Contact" defaultValue={defaults.reference1Contact} /></div>
        <div className="grid gap-1"><Label htmlFor="reference2Name">Reference 2 – Person Name</Label><Input id="reference2Name" name="reference2Name" defaultValue={defaults.reference2Name} /></div>
        <div className="grid gap-1"><Label htmlFor="reference2Relationship">Relationship with Person (Ref 2)</Label><Input id="reference2Relationship" name="reference2Relationship" defaultValue={defaults.reference2Relationship} /></div>
        <div className="grid gap-1"><Label htmlFor="reference2Contact">Contact No (Ref 2)</Label><Input id="reference2Contact" name="reference2Contact" defaultValue={defaults.reference2Contact} /></div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
        {sectionTitle("Salary Details")}
        <div className="grid gap-1"><Label htmlFor="presentSalary">Present Salary</Label><Input id="presentSalary" name="presentSalary" type="number" min={0} step="0.01" defaultValue={defaults.presentSalary} /></div>
        <div className="grid gap-1"><Label htmlFor="salaryExpectation">Salary Expectation</Label><Input id="salaryExpectation" name="salaryExpectation" type="number" min={0} step="0.01" defaultValue={defaults.salaryExpectation} /></div>
        <div className="grid gap-1"><Label htmlFor="salaryOffered">Salary Offered</Label><Input id="salaryOffered" name="salaryOffered" type="number" min={0} step="0.01" defaultValue={defaults.salaryOffered} /></div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
        {sectionTitle("Final Section")}
        <div className="grid gap-1"><Label htmlFor="joiningDate">Joining Date</Label><Input id="joiningDate" name="joiningDate" type="date" defaultValue={defaults.joiningDate} required /></div>
        <div className="grid gap-1"><Label htmlFor="candidateSignatureText">Candidate Signature / Name</Label><Input id="candidateSignatureText" name="candidateSignatureText" defaultValue={defaults.candidateSignatureText} /></div>
        <div className="grid gap-1"><Label htmlFor="candidateSignatureDate">Candidate Signature Date</Label><Input id="candidateSignatureDate" name="candidateSignatureDate" type="date" defaultValue={defaults.candidateSignatureDate} /></div>
        <div className="grid gap-1"><Label htmlFor="appointeeSignatureText">Signature of Appointee</Label><Input id="appointeeSignatureText" name="appointeeSignatureText" defaultValue={defaults.appointeeSignatureText} /></div>
        <div className="grid gap-1"><Label htmlFor="approvalAuthoritySignatureText">Signature of Approval Authority</Label><Input id="approvalAuthoritySignatureText" name="approvalAuthoritySignatureText" defaultValue={defaults.approvalAuthoritySignatureText} /></div>
      </div>

      <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">{submitLabel}</button>
    </div>
  );
}
