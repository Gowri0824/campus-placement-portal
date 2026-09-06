import { normalizeBranch, parseAllowedBranches } from "./branches";

// Display preview only; database application checks remain authoritative.
export function getEligibleStudents(students, drive) {
  const parsedCriteria = parseDriveCriteria(drive);

  if (!parsedCriteria.isValid) {
    return { students: [], warnings: parsedCriteria.warnings };
  }

  const eligibleStudents = students.filter((student) => {
    if (parsedCriteria.minimumCgpa !== null) {
      const studentCgpa = parseStudentCgpa(student.cgpa);

      if (
        studentCgpa === null ||
        studentCgpa < parsedCriteria.minimumCgpa
      ) {
        return false;
      }
    }

    if (parsedCriteria.allowedBranches !== null) {
      const studentBranch = normalizeBranch(student.branch);

      if (
        !studentBranch ||
        !parsedCriteria.allowedBranches.includes(studentBranch)
      ) {
        return false;
      }
    }

    return true;
  });

  return { students: eligibleStudents, warnings: parsedCriteria.warnings };
}

export function parseDriveCriteria(drive) {
  const warnings = [];
  let minimumCgpa = null;

  if (
    drive.min_cgpa !== null &&
    drive.min_cgpa !== undefined &&
    drive.min_cgpa !== ""
  ) {
    const parsedMinimumCgpa = Number(drive.min_cgpa);

    if (
      !Number.isFinite(parsedMinimumCgpa) ||
      parsedMinimumCgpa < 0 ||
      parsedMinimumCgpa > 10
    ) {
      warnings.push(
        "This drive has an invalid minimum CGPA. Eligibility is withheld until the criterion is corrected."
      );
    } else {
      minimumCgpa = parsedMinimumCgpa;
    }
  }

  const branchCriteria = parseAllowedBranches(drive.allowed_branches);

  if (branchCriteria.error) {
    warnings.push(
      "This drive has malformed allowed branches. Eligibility is withheld until the criterion is corrected."
    );
  }

  return {
    minimumCgpa,
    allowedBranches: branchCriteria.branches,
    isValid: warnings.length === 0,
    warnings,
  };
}

function parseStudentCgpa(cgpa) {
  if (cgpa === null || cgpa === undefined || cgpa === "") {
    return null;
  }

  const parsedCgpa = Number(cgpa);

  if (!Number.isFinite(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
    return null;
  }

  return parsedCgpa;
}
