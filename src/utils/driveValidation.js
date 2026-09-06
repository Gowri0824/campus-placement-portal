import { normalizeBranchInput } from "./branches";
import { normalizeDateOnly } from "./dates";

export function createEmptyDriveForm() {
  return {
    companyId: "",
    role: "",
    minCgpa: "",
    allowedBranches: "",
    packageValue: "",
    deadline: "",
  };
}

export function validateDriveForm(formData, companies) {
  if (!formData.companyId) {
    return "Company is required.";
  }

  if (!companies.some((company) => company.id === formData.companyId)) {
    return "Select a valid company.";
  }

  if (!formData.role.trim()) {
    return "Role is required.";
  }

  if (formData.minCgpa !== "") {
    const minimumCgpa = Number(formData.minCgpa);

    if (Number.isNaN(minimumCgpa) || minimumCgpa < 0 || minimumCgpa > 10) {
      return "Minimum CGPA must be between 0 and 10.";
    }
  }

  if (formData.deadline && !normalizeDateOnly(formData.deadline)) {
    return "Deadline must be a valid date.";
  }

  return "";
}

export function toDrivePayload(formData) {
  return {
    company_id: formData.companyId,
    role: formData.role.trim(),
    min_cgpa: formData.minCgpa === "" ? null : Number(formData.minCgpa),
    allowed_branches: normalizeBranchInput(formData.allowedBranches),
    package: formData.packageValue.trim() || null,
    deadline: formData.deadline || null,
  };
}

export function driveToFormData(drive) {
  return {
    companyId: drive.company_id || "",
    role: drive.role || "",
    minCgpa: drive.min_cgpa ?? "",
    allowedBranches: drive.allowed_branches || "",
    packageValue: drive.package || "",
    deadline: drive.deadline || "",
  };
}
