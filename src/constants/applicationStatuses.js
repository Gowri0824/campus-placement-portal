export const APPLICATION_STATUS = Object.freeze({
  APPLIED: "Applied",
  SELECTED: "Selected",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
});

export const APPLICATION_STATUS_OPTIONS = Object.freeze([
  { value: APPLICATION_STATUS.APPLIED, label: "Applied (Pending)" },
  { value: APPLICATION_STATUS.SELECTED, label: "Selected" },
  { value: APPLICATION_STATUS.REJECTED, label: "Rejected" },
  { value: APPLICATION_STATUS.WITHDRAWN, label: "Withdrawn" },
]);

export const APPLICATION_STATUS_VALUES = Object.freeze(
  APPLICATION_STATUS_OPTIONS.map((option) => option.value)
);

export const RECRUITER_DECISION_STATUSES = Object.freeze([
  APPLICATION_STATUS.SELECTED, APPLICATION_STATUS.REJECTED,
]);
