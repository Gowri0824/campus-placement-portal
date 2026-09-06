import { fetchRowsByIds } from "./supabaseReads";
import { supabase } from "./supabaseClient";
import { mapApplications } from "../utils/adminApplications";
import { APPLICATION_STATUS } from "../constants/applicationStatuses";

export async function fetchStudentApplications(studentId) {
  const applications = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("applications")
      .select("id, status, applied_at, drive_id")
      .eq("student_id", studentId)
      .order("applied_at", { ascending: false })
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) throw error;
    applications.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return applications;
}

export async function findStudentApplication(studentId, driveId) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("drive_id", driveId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createStudentApplication(studentId, driveId) {
  const { error } = await supabase.from("applications").insert({
    student_id: studentId,
    drive_id: driveId,
    status: APPLICATION_STATUS.APPLIED,
  });
  if (error) throw error;
}

async function transitionStudentApplication(id, fromStatus, status, noResultMessage) {
  const { data, error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", id)
    .eq("status", fromStatus)
    .select("id, status")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(noResultMessage);
  if (data.id !== id || data.status !== status) {
    throw new Error("The application status update could not be verified. Refresh and try again.");
  }
  return data;
}

export function withdrawStudentApplication(id) {
  return transitionStudentApplication(
    id, APPLICATION_STATUS.APPLIED, APPLICATION_STATUS.WITHDRAWN,
    "The application was not withdrawn. Its status may have already changed."
  );
}

export function reapplyStudentApplication(id) {
  return transitionStudentApplication(
    id, APPLICATION_STATUS.WITHDRAWN, APPLICATION_STATUS.APPLIED,
    "The application was not re-applied. Its status may have already changed."
  );
}

export async function fetchApplicationsData() {
  const { data: applicationData, error: applicationsError } =
    await fetchAllApplications();

  if (applicationsError) {
    return { data: null, error: applicationsError };
  }

  const applications = applicationData || [];
  const studentIds = uniqueIds(
    applications.map((application) => application.student_id)
  );
  const driveIds = uniqueIds(
    applications.map((application) => application.drive_id)
  );
  const [studentsResult, drivesResult] = await Promise.all([
    fetchRowsByIds(
      "students",
      "id, profile_id, roll_number, branch",
      studentIds
    ),
    fetchRowsByIds(
      "placement_drives",
      "id, company_id, role",
      driveIds
    ),
  ]);

  if (studentsResult.error) {
    return { data: null, error: studentsResult.error };
  }

  if (drivesResult.error) {
    return { data: null, error: drivesResult.error };
  }

  const students = studentsResult.data;
  const drives = drivesResult.data;
  const profileIds = uniqueIds(students.map((student) => student.profile_id));
  const companyIds = uniqueIds(drives.map((drive) => drive.company_id));
  const [profilesResult, companiesResult] = await Promise.all([
    fetchRowsByIds("profiles", "id, full_name, email", profileIds),
    fetchRowsByIds("companies", "id, company_name", companyIds),
  ]);

  if (profilesResult.error) {
    return { data: null, error: profilesResult.error };
  }

  if (companiesResult.error) {
    return { data: null, error: companiesResult.error };
  }

  const mappedApplications = mapApplications(
    applications, students, drives, profilesResult.data, companiesResult.data
  );

  return { data: mappedApplications, error: null };
}

async function fetchAllApplications() {
  const pageSize = 1000;
  const applications = [];
  let pageStart = 0;

  while (true) {
    const { data, error } = await supabase
      .from("applications")
      .select("id, student_id, drive_id, status, applied_at")
      .order("applied_at", { ascending: false })
      .order("id", { ascending: true })
      .range(pageStart, pageStart + pageSize - 1);

    if (error) {
      return { data: null, error };
    }

    const page = data || [];
    applications.push(...page);

    if (page.length < pageSize) {
      break;
    }

    pageStart += pageSize;
  }

  return { data: applications, error: null };
}

function uniqueIds(ids) {
  return [...new Set(ids.filter(Boolean))];
}


export async function updateApplicationStatus(applicationId, status) {
  const { data, error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId)
    .select("id, status")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const noResultError = new Error(
      "The application was not updated. Check the admin update policy in Supabase."
    );
    noResultError.code = "RLS_NO_RESULT";
    throw noResultError;
  }
  if (data.id !== applicationId || data.status !== status) {
    throw new Error("The application status update could not be verified. Refresh and try again.");
  }
  return data;
}
