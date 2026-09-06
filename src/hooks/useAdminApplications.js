import { useEffect, useMemo, useRef, useState } from "react";
import { APPLICATION_STATUS_VALUES } from "../constants/applicationStatuses";
import { fetchApplicationsData, updateApplicationStatus } from "../services/applicationsService";
import { getApplicationCounts } from "../utils/applicationStatus";
import { getApplicationErrorMessage } from "../utils/applicationErrors";
import { createStatusSelections, filterApplications, getReferenceWarnings } from "../utils/adminApplications";

export function useAdminApplications() {
  const [applications, setApplications] = useState([]);
  const [statusSelections, setStatusSelections] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const updateInFlight = useRef(false);
  const isMounted = useRef(false);

  useEffect(() => {
    let active = true;
    isMounted.current = true;
    fetchApplicationsData()
      .then(({ data, error: requestError }) => {
        if (!active) return;
        if (requestError) throw requestError;
        setApplications(data);
        setStatusSelections(createStatusSelections(data));
      })
      .catch((requestError) => {
        if (active) setError(getApplicationErrorMessage(requestError, "Unable to load applications."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      isMounted.current = false;
    };
  }, []);

  const counts = useMemo(() => getApplicationCounts(applications), [applications]);
  const referenceWarnings = useMemo(() => getReferenceWarnings(applications), [applications]);
  const filteredApplications = useMemo(
    () => filterApplications(applications, statusFilter),
    [applications, statusFilter],
  );

  function handleStatusSelection(applicationId, status) {
    setStatusSelections((current) => ({ ...current, [applicationId]: status }));
  }

  async function handleStatusUpdate(application) {
    if (updateInFlight.current) return;
    const nextStatus = statusSelections[application.id];
    setError("");
    setSuccessMessage("");
    if (!nextStatus) {
      setError("Select an application status.");
      return;
    }
    if (nextStatus === application.status) {
      setSuccessMessage("The application already has that status.");
      return;
    }
    if (!APPLICATION_STATUS_VALUES.includes(nextStatus)) {
      setError("Select one of the supported application statuses.");
      return;
    }

    updateInFlight.current = true;
    setUpdatingApplicationId(application.id);
    try {
      const updated = await updateApplicationStatus(application.id, nextStatus);
      if (!isMounted.current) return;
      setApplications((current) => current.map((record) =>
        record.id === updated.id ? { ...record, status: updated.status } : record
      ));
      setStatusSelections((current) => ({ ...current, [updated.id]: updated.status }));
      setSuccessMessage("Application status updated successfully.");
    } catch (updateError) {
      if (isMounted.current) {
        setError(getApplicationErrorMessage(updateError, "Unable to update application status."));
      }
    } finally {
      updateInFlight.current = false;
      if (isMounted.current) setUpdatingApplicationId(null);
    }
  }

  return {
    applications, filteredApplications, counts, referenceWarnings,
    statusSelections, statusFilter, updatingApplicationId, isLoading,
    error, successMessage, setStatusFilter, handleStatusSelection, handleStatusUpdate,
  };
}
