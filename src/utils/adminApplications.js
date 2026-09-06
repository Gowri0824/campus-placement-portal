import { APPLICATION_STATUS, APPLICATION_STATUS_OPTIONS as statusOptions, APPLICATION_STATUS_VALUES as supportedStatusValues } from "../constants/applicationStatuses";
import { getApplicationStatusCategory } from "./applicationStatus";

export function mapApplications(applications, students, drives, profiles, companies) {
  const studentById = new Map(students.map((student) => [student.id, student]));
  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile])
  );
  const driveById = new Map(drives.map((drive) => [drive.id, drive]));
  const companyById = new Map(
    companies.map((company) => [company.id, company])
  );

  const mappedApplications = applications.map((application) => {
    const student = studentById.get(application.student_id) || null;
    const profile = student
      ? profileById.get(student.profile_id) || null
      : null;
    const drive = driveById.get(application.drive_id) || null;
    const company = drive
      ? companyById.get(drive.company_id) || null
      : null;

    return {
      ...application,
      student_name: profile?.full_name || "Name not available",
      email: profile?.email || "",
      roll_number: student?.roll_number || "",
      branch: student?.branch || "",
      company_name: company?.company_name || "Company not available",
      role: drive?.role || "",
      hasStudent: Boolean(student),
      hasProfile: Boolean(profile),
      hasDrive: Boolean(drive),
      hasCompany: Boolean(company),
    };
  });

  return mappedApplications;
}

export function createStatusSelections(applications) {
  return Object.fromEntries(
    applications.map((application) => [
      application.id,
      application.status || APPLICATION_STATUS.APPLIED,
    ])
  );
}

export function getStatusOptions(currentStatus) {
  if (!currentStatus || supportedStatusValues.includes(currentStatus)) {
    return statusOptions;
  }

  return [
    { value: currentStatus, label: `${currentStatus} (Current)` },
    ...statusOptions,
  ];
}

export function getReferenceWarnings(applications) {
  const missingStudents = applications.filter(
    (application) => !application.hasStudent
  ).length;
  const missingProfiles = applications.filter(
    (application) => application.hasStudent && !application.hasProfile
  ).length;
  const missingDrives = applications.filter(
    (application) => !application.hasDrive
  ).length;
  const missingCompanies = applications.filter(
    (application) => application.hasDrive && !application.hasCompany
  ).length;
  const warnings = [];

  if (missingStudents > 0) {
    warnings.push(
      `${missingStudents} application(s) reference missing student records.`
    );
  }

  if (missingProfiles > 0) {
    warnings.push(
      `${missingProfiles} application(s) reference missing profile records.`
    );
  }

  if (missingDrives > 0) {
    warnings.push(
      `${missingDrives} application(s) reference missing placement drives.`
    );
  }

  if (missingCompanies > 0) {
    warnings.push(
      `${missingCompanies} application(s) reference missing company records.`
    );
  }

  return warnings;
}


export function filterApplications(applications, statusFilter) {
  return applications.filter((application) =>
    statusFilter === "all" || getApplicationStatusCategory(application.status) === statusFilter
  );
}
