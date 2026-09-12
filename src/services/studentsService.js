import { getResumeObjectPath, createResumeAccessUrl } from "./resumeStorage";
import { supabase } from "./supabaseClient";
import { mapStudentsWithProfiles } from "../utils/studentDirectory";
import { fetchRowsByIds } from "./supabaseReads";

const STUDENT_PAGE_SIZE = 1000;
const PROFILE_ID_CHUNK_SIZE = 100;
const STUDENT_COLUMNS =
  "id, profile_id, roll_number, branch, cgpa, graduation_year, skills, resume_url, created_at";
const PROFILE_COLUMNS = "id, full_name, email, role, created_at";

export async function fetchStudentForProfile(profileId) {
  const { data, error } = await supabase
    .from("students")
    .select("id, branch, cgpa")
    .eq("profile_id", profileId)
    .single();
  if (error) throw error;
  return data;
}

async function fetchAllStudents() {
  const students = [];
  let pageStart = 0;

  while (true) {
    const { data, error } = await supabase
      .from("students")
      .select(STUDENT_COLUMNS)
      .order("roll_number", { ascending: true })
      .order("id", { ascending: true })
      .range(pageStart, pageStart + STUDENT_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = data || [];
    students.push(...page);

    if (page.length < STUDENT_PAGE_SIZE) {
      break;
    }

    pageStart += STUDENT_PAGE_SIZE;
  }

  return students;
}

async function fetchProfilesByIds(profileIds) {
  if (profileIds.length === 0) {
    return [];
  }

  const chunks = [];

  for (let index = 0; index < profileIds.length; index += PROFILE_ID_CHUNK_SIZE) {
    chunks.push(profileIds.slice(index, index + PROFILE_ID_CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map((profileIdChunk) =>
      supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .in("id", profileIdChunk),
    ),
  );
  const failedResult = results.find((result) => result.error);

  if (failedResult) {
    throw failedResult.error;
  }

  return results.flatMap((result) => result.data || []);
}

async function attachStudentProfiles(students) {
  const profileIds = [
    ...new Set(students.map((student) => student.profile_id).filter(Boolean)),
  ];
  const profiles = await fetchProfilesByIds(profileIds);

  return mapStudentsWithProfiles(students, profiles).map((student) => ({
    ...student,
    resume_path: getResumeObjectPath(student.resume_url),
  }));
}

export async function fetchStudentDirectory() {
  return attachStudentProfiles(await fetchAllStudents());
}

export async function fetchStudentsByIds(studentIds) {
  const ids = [...new Set(studentIds.filter(Boolean))];
  const { data, error } = await fetchRowsByIds("students", STUDENT_COLUMNS, ids);
  if (error) throw error;
  return attachStudentProfiles(data);
}

export async function createStudentResumeAccessUrl(resumePath) {
  const resumeAccess = await createResumeAccessUrl(resumePath);

  if (resumeAccess.error) {
    throw resumeAccess.error;
  }

  if (!resumeAccess.path || !resumeAccess.url) {
    throw new Error("The secure resume link is unavailable.");
  }

  return resumeAccess.url;
}
