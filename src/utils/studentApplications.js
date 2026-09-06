import { APPLICATION_STATUS } from "../constants/applicationStatuses";
import { normalizeBranch } from "./branches";
import { parseDriveCriteria } from "./eligibility";
import { isDeadlineOpen } from "./dates";

// Preserve the Student preview; persistence-level eligibility remains authoritative.
export function checkStudentEligibility(student, drive) {
  if (!student || !drive) {
    return false;
  }

  const criteria = parseDriveCriteria(drive);

  if (!criteria.isValid) {
    return false;
  }

  if (criteria.minimumCgpa !== null) {
    const studentCgpa = Number(student.cgpa);

    if (!Number.isFinite(studentCgpa) || studentCgpa < criteria.minimumCgpa) {
      return false;
    }
  }

  if (criteria.allowedBranches !== null) {
    const studentBranch = normalizeBranch(student.branch);

    if (!studentBranch || !criteria.allowedBranches.includes(studentBranch)) {
      return false;
    }
  }

  return true;
}


export function mapDrivesWithCompanies(drives, companies) {
  const companyById = new Map(companies.map((company) => [company.id, company]));
  return drives.map((drive) => ({
    ...drive,
    companies: companyById.get(drive.company_id) || null,
  }));
}

export function mapStudentApplications(applications, drives) {
  const driveById = new Map(drives.map((drive) => [drive.id, drive]));
  return applications.map((application) => ({
    ...application,
    placement_drives: driveById.get(application.drive_id) || null,
  }));
}

export function getStatusesByDrive(applications) {
  return Object.fromEntries(applications.map((application) => [
    application.drive_id, application.status,
  ]));
}

export function getDriveActionState(student, drive, applicationStatus, now) {
  const isEligible = checkStudentEligibility(student, drive);
  const deadlineOpen = isDeadlineOpen(drive.deadline, now);
  return {
    isEligible, deadlineOpen, applicationStatus,
    canApply: !applicationStatus && deadlineOpen && isEligible,
  };
}

export function getStudentApplicationActions(application, now) {
  return {
    canWithdraw: application.status === APPLICATION_STATUS.APPLIED,
    canReapply: application.status === APPLICATION_STATUS.WITHDRAWN &&
      isDeadlineOpen(application.placement_drives?.deadline, now),
  };
}

export function getExistingApplicationMessage(status) {
  return status === APPLICATION_STATUS.WITHDRAWN
    ? "This application was withdrawn. Re-apply from My Applications while the deadline is open."
    : "You have already applied for this drive.";
}
