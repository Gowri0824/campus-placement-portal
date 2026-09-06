import { ROLES } from "../constants/roles";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function mapStudentsWithProfiles(students, profiles) {
  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );

  return students.map((student) => {
    const profile = profileById.get(student.profile_id) || null;

    return {
      ...student,
      full_name: profile?.full_name || "Name not available",
      email: profile?.email || "",
      profile_role: profile?.role || "",
      profile_created_at: profile?.created_at || null,
      hasProfile: Boolean(profile),
      hasStudentRole: normalizeText(profile?.role) === ROLES.STUDENT,
    };
  });
}

export function filterStudents(
  students,
  { searchTerm, branchFilter, graduationYearFilter, minimumCgpa },
) {
  const normalizedSearchTerm = normalizeText(searchTerm);

  return students.filter((student) => {
    const matchesSearch =
      !normalizedSearchTerm ||
      [student.full_name, student.email, student.roll_number].some((value) =>
        normalizeText(value).includes(normalizedSearchTerm),
      );
    const matchesBranch =
      !branchFilter || normalizeText(student.branch) === branchFilter;
    const matchesGraduationYear =
      !graduationYearFilter ||
      String(student.graduation_year || "") === graduationYearFilter;
    const studentCgpa = Number(student.cgpa);
    const matchesCgpa =
      minimumCgpa === null ||
      (student.cgpa !== null &&
        student.cgpa !== undefined &&
        student.cgpa !== "" &&
        Number.isFinite(studentCgpa) &&
        studentCgpa >= minimumCgpa);

    return (
      matchesSearch &&
      matchesBranch &&
      matchesGraduationYear &&
      matchesCgpa
    );
  });
}

export function getBranchOptions(students) {
  const branchByValue = new Map();

  students.forEach((student) => {
    const label = String(student.branch || "").trim();
    const value = normalizeText(label);

    if (value && !branchByValue.has(value)) {
      branchByValue.set(value, label);
    }
  });

  return [...branchByValue.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((firstBranch, secondBranch) =>
      firstBranch.label.localeCompare(secondBranch.label),
    );
}

export function getGraduationYearOptions(students) {
  return [
    ...new Set(
      students
        .map((student) => student.graduation_year)
        .filter((graduationYear) => Number.isInteger(graduationYear)),
    ),
  ].sort((firstYear, secondYear) => secondYear - firstYear);
}

export function parseMinimumCgpaFilter(value) {
  if (value === "") {
    return { value: null, error: "" };
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 10) {
    return {
      value: null,
      error: "Minimum CGPA must be between 0 and 10. The filter is not applied.",
    };
  }

  return { value: parsedValue, error: "" };
}

export function getStudentProfileIssueCounts(students) {
  return students.reduce(
    (counts, student) => ({
      missingProfileCount:
        counts.missingProfileCount + (student.hasProfile ? 0 : 1),
      profileRoleMismatchCount:
        counts.profileRoleMismatchCount +
        (student.hasProfile && !student.hasStudentRole ? 1 : 0),
    }),
    { missingProfileCount: 0, profileRoleMismatchCount: 0 },
  );
}

export function getSafeHttpUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const parsedUrl = new URL(value);

    return ["http:", "https:"].includes(parsedUrl.protocol)
      ? parsedUrl.href
      : "";
  } catch {
    return "";
  }
}
