import { APPLICATION_STATUS } from "../constants/applicationStatuses";

export function getApplicationStatusCategory(status) {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  if (normalizedStatus === APPLICATION_STATUS.SELECTED.toLowerCase()) {
    return "selected";
  }

  if (normalizedStatus === APPLICATION_STATUS.REJECTED.toLowerCase()) {
    return "rejected";
  }

  if (normalizedStatus === APPLICATION_STATUS.WITHDRAWN.toLowerCase()) {
    return "withdrawn";
  }

  return "pending";
}

export function getApplicationCounts(applications) {
  return applications.reduce(
    (counts, application) => {
      const category = getApplicationStatusCategory(application.status);

      counts.total += 1;
      counts[category] += 1;

      return counts;
    },
    { total: 0, pending: 0, selected: 0, rejected: 0, withdrawn: 0 }
  );
}
