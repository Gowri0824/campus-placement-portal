import { supabase } from "./supabaseClient";
import { getResumeObjectPath } from "./resumeStorage";

export async function fetchStudentProfile(userId, email = "") {
  const [profileResult, studentResult] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", userId).single(),
    supabase.from("students")
      .select("roll_number, branch, cgpa, graduation_year, skills, resume_url")
      .eq("profile_id", userId).single(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (studentResult.error) throw studentResult.error;
  const profile = profileResult.data;
  const student = studentResult.data;
  return {
    fullName: profile.full_name || "",
    email: profile.email || email,
    rollNumber: student.roll_number || "",
    branch: student.branch || "",
    cgpa: student.cgpa ?? "",
    graduationYear: student.graduation_year ?? "",
    skills: student.skills || "",
    resumePath: getResumeObjectPath(student.resume_url),
  };
}

export async function updateStudentProfile(userId, details) {
  const payload = {
    branch: details.branch, cgpa: details.cgpa,
    graduation_year: details.graduation_year, skills: details.skills,
  };
  const { data, error } = await supabase.from("students").update(payload)
    .eq("profile_id", userId).select("branch, cgpa, graduation_year, skills").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The profile was not updated. Check your session and student update permissions.");
  return data;
}

export async function updateStudentResumePath(userId, resumePath) {
  // Only an owned object path can be persisted, never a temporary signed URL.
  const segments = resumePath.split("/");
  if (segments[0] !== userId || segments.length < 2 ||
      segments.some((segment) => !segment || segment === "." || segment === ".." ||
        /[%\\\\?#]/.test(segment))) {
    throw new Error("Invalid resume storage path.");
  }
  const { data, error } = await supabase.from("students").update({ resume_url: resumePath })
    .eq("profile_id", userId).select("resume_url").maybeSingle();
  if (error) throw error;
  if (!data || data.resume_url !== resumePath) {
    throw new Error("The resume reference was not saved. Check your session and student update permissions.");
  }
  return data.resume_url;
}
