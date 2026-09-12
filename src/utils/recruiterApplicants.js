import { APPLICATION_STATUS, APPLICATION_STATUS_VALUES } from "../constants/applicationStatuses";
import { getReferenceWarnings } from "./adminApplications";
import { mapDrivesWithCompanies, mapStudentApplications } from "./studentApplications";

export function mapRecruiterApplicants(applications, students, drives, company) {
  const companyDrives = drives.filter((drive) => drive.company_id === company?.id);
  const mapped = mapStudentApplications(applications, mapDrivesWithCompanies(companyDrives, company ? [company] : []));
  const studentById = new Map(students.map((student) => [student.id, student]));
  // UX defense only. RLS remains the authority on every application/detail read.
  const visible = mapped.filter((application) => application.placement_drives).map((application) => {
    const student = studentById.get(application.student_id) || null;
    const drive = application.placement_drives;
    return {
      ...application, student,
      student_name: student?.full_name || "Name not available",
      email: student?.email || "",
      company_name: drive.companies?.company_name || "Company not available",
      role: drive.role || "Role not available",
      hasStudent: Boolean(student), hasProfile: Boolean(student?.hasProfile),
      hasDrive: true, hasCompany: Boolean(drive.companies),
    };
  }).sort((first, second) =>
    (Date.parse(second.applied_at) || 0) - (Date.parse(first.applied_at) || 0)
      || String(first.id).localeCompare(String(second.id)));
  const warnings = getReferenceWarnings(visible);
  if (visible.length !== applications.length) {
    warnings.push("Some applications have unavailable company-drive references and were excluded. Reload to check the current assignment.");
  }
  if (visible.some((application) => !APPLICATION_STATUS_VALUES.includes(application.status))) {
    warnings.push("Some applications have an unrecognized status; they are shown under All statuses only.");
  }
  return { applications: visible, warnings };
}

export function filterRecruiterApplicants(applications, driveId, status) {
  return applications.filter((application) => (!driveId || application.drive_id === driveId)
    && (!status || application.status === status));
}

export function canPreviewApplicantResume(application) {
  return Boolean(application.student?.resume_path
    && [APPLICATION_STATUS.APPLIED, APPLICATION_STATUS.SELECTED].includes(application.status));
}
