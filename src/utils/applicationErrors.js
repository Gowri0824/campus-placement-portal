const FRIENDLY_ERROR_PREFIXES = [
  "APPLICATION_DEADLINE_CLOSED:",
  "APPLICATION_REAPPLY_CLOSED:",
  "APPLICATION_NOT_ELIGIBLE:",
  "APPLICATION_STATUS_TRANSITION_DENIED:",
];

export function isDuplicateApplicationError(error) {
  return (
    error?.code === "23505" ||
    String(error?.message || "").includes(
      "applications_student_drive_unique"
    )
  );
}

export function getApplicationErrorMessage(
  error,
  fallback = "Unable to update the application."
) {
  const message = String(error?.message || "");
  const prefix = FRIENDLY_ERROR_PREFIXES.find((candidate) =>
    message.startsWith(candidate)
  );

  return prefix ? message.slice(prefix.length).trim() : message || fallback;
}
