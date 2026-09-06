export function normalizeBranch(branch) {
  return String(branch || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function isUniversalBranchValue(branch) {
  return ["all", "all branches", "any", "*"].includes(branch);
}

export function parseAllowedBranches(branches) {
  if (branches === null || branches === undefined || branches === "") {
    return { branches: null, error: false };
  }

  let branchValues = branches;

  if (typeof branches === "string") {
    const trimmedBranches = branches.trim();

    if (!trimmedBranches) {
      return { branches: null, error: false };
    }

    if (trimmedBranches.startsWith("[")) {
      try {
        branchValues = JSON.parse(trimmedBranches);
      } catch {
        return { branches: null, error: true };
      }
    } else {
      branchValues = trimmedBranches.split(/[,;|\n]+/);
    }
  }

  if (!Array.isArray(branchValues)) {
    return { branches: null, error: true };
  }

  const normalizedBranches = branchValues
    .map(normalizeBranch)
    .filter(Boolean);

  if (normalizedBranches.some(isUniversalBranchValue)) {
    return { branches: null, error: false };
  }

  if (normalizedBranches.length === 0) {
    return { branches: null, error: false };
  }

  return { branches: [...new Set(normalizedBranches)], error: false };
}

export function formatAllowedBranches(branches) {
  const parsedBranches = parseAllowedBranches(branches);

  if (parsedBranches.error) {
    return "Invalid criteria";
  }

  return parsedBranches.branches === null
    ? "All branches"
    : parsedBranches.branches.join(", ");
}

export function normalizeBranchInput(branches) {
  const normalizedValue = String(branches || "")
    .split(",")
    .map((branch) => branch.trim())
    .filter(Boolean)
    .join(", ");

  return normalizedValue || null;
}
