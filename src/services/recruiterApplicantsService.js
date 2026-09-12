import { fetchApplicationsForDrives } from "./applicationsService";
import { fetchCompanyDrives } from "./drivesService";
import { fetchStudentsByIds } from "./studentsService";
import { mapRecruiterApplicants } from "../utils/recruiterApplicants";
import { supabase } from "./supabaseClient";
import { APPLICATION_STATUS, RECRUITER_DECISION_STATUSES } from "../constants/applicationStatuses";

export async function decideRecruiterApplication(applicationId, driveId, status) {
  if (!applicationId || !driveId || !RECRUITER_DECISION_STATUSES.includes(status)) {
    throw new Error("Select or reject an existing Applied application.");
  }
  // Expected status prevents stale/repeated decisions. RLS resolves company scope.
  const { data, error } = await supabase.from("applications").update({ status })
    .eq("id", applicationId).eq("drive_id", driveId).eq("status", APPLICATION_STATUS.APPLIED)
    .select("id, drive_id, status").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The application was not updated. Its status or your company access may have changed. Reload before trying again.");
  if (data.id !== applicationId || data.drive_id !== driveId || data.status !== status) {
    throw new Error("The decision could not be verified. Reload to check the current application status.");
  }
  return data;
}

export async function fetchRecruiterApplicants(company) {
  if (!company?.id) return { drives: [], applications: [], warnings: [] };
  const drives = (await fetchCompanyDrives(company.id)).filter((drive) => drive.company_id === company.id);
  const driveIds = drives.map((drive) => drive.id);
  const applications = await fetchApplicationsForDrives(driveIds);
  const driveIdSet = new Set(driveIds);
  const students = await fetchStudentsByIds(applications
    .filter((application) => driveIdSet.has(application.drive_id))
    .map((application) => application.student_id));
  return { drives, ...mapRecruiterApplicants(applications, students, drives, company) };
}
