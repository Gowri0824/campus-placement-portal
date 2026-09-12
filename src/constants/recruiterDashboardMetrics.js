import { APPLICATION_STATUS } from "./applicationStatuses";

export const RECRUITER_DASHBOARD_METRICS = Object.freeze([
  { key: "drives", title: "Total Company Drives" },
  { key: "applications", title: "Total Applicants" },
  { key: "pending", title: "Applied / Pending", status: APPLICATION_STATUS.APPLIED },
  { key: "selected", title: "Selected", status: APPLICATION_STATUS.SELECTED },
  { key: "rejected", title: "Rejected", status: APPLICATION_STATUS.REJECTED },
  { key: "withdrawn", title: "Withdrawn", status: APPLICATION_STATUS.WITHDRAWN },
]);
