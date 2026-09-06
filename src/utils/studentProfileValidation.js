import { MAX_RESUME_SIZE_IN_MB } from "../constants/storage";

export function validateResumeFile(file) {
    if (!file) {
      return "Please select a resume file.";
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return "Only PDF resume files are allowed.";
    }

    const fileSizeInMb = file.size / (1024 * 1024);
    if (fileSizeInMb > MAX_RESUME_SIZE_IN_MB) {
      return `Resume must be ${MAX_RESUME_SIZE_IN_MB} MB or smaller.`;
    }

    return "";
}

export function validateStudentProfile(formData) {
    if (!formData.branch || !formData.cgpa || !formData.graduationYear) {
      return "Please fill in branch, CGPA, and graduation year.";
    }

    const cgpa = Number(formData.cgpa);
    if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
      return "CGPA must be a number between 0 and 10.";
    }

    const graduationYear = Number(formData.graduationYear);
    if (
      !Number.isInteger(graduationYear) ||
      graduationYear < 2000 ||
      graduationYear > 2100
    ) {
      return "Please enter a valid graduation year.";
    }

    return "";
}

export function toStudentProfilePayload(formData) {
  return {
    branch: formData.branch.trim(),
    cgpa: Number(formData.cgpa),
    graduation_year: Number(formData.graduationYear),
    skills: formData.skills.trim(),
  };
}

export function toStudentProfileForm(profile) {
  return {
    branch: profile.branch,
    cgpa: String(profile.cgpa),
    graduationYear: String(profile.graduationYear),
    skills: profile.skills,
  };
}

export function getResumeName(value) {
  if (!value) return "";
  let filename;
  try { filename = new URL(value).pathname.split("/").pop() || ""; }
  catch { filename = String(value).split("/").pop() || ""; }
  try { filename = decodeURIComponent(filename); }
  catch { /* Legacy names may contain malformed percent escapes. */ }
  return filename.replace(/^\d+-/, "");
}
