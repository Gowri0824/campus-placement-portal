import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { APPLICATION_STATUS } from "../constants/applicationStatuses";
import { fetchStudentForProfile } from "../services/studentsService";
import { fetchStudentDrives } from "../services/drivesService";
import { fetchStudentApplications, withdrawStudentApplication, reapplyStudentApplication } from "../services/applicationsService";
import { getApplicationErrorMessage } from "../utils/applicationErrors";
import { getDeadlineClosedMessage } from "../utils/dates";
import { getStudentApplicationActions, mapStudentApplications } from "../utils/studentApplications";

export function useStudentApplications() {
  const { user } = useAuth();
  const userId = user?.id;
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [withdrawingApplicationId, setWithdrawingApplicationId] = useState(null);
  const [reapplyingApplicationId, setReapplyingApplicationId] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const activeUser = useRef(null);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    activeUser.current = userId;
    async function load() {
      if (!userId) return;
      setIsLoading(true);
      setError("");
      try {
        const student = await fetchStudentForProfile(userId);
        const records = await fetchStudentApplications(student.id);
        const drives = await fetchStudentDrives(records.map((record) => record.drive_id));
        if (active) setApplications(mapStudentApplications(records, drives));
      } catch (requestError) {
        if (active) setError(getApplicationErrorMessage(requestError, "Unable to load your applications."));
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => { active = false; activeUser.current = null; };
  }, [userId]);

  async function runTransition(application, reapply) {
    if (pending.current) return;
    const actions = getStudentApplicationActions(application);
    if (!reapply && !actions.canWithdraw) {
      setError("Only applications with Applied status can be withdrawn.");
      return;
    }
    if (reapply && application.status !== APPLICATION_STATUS.WITHDRAWN) {
      setError("Only withdrawn applications can be re-applied.");
      return;
    }
    if (reapply && !actions.canReapply) {
      setError(getDeadlineClosedMessage(application.placement_drives?.deadline));
      return;
    }
    const confirmed = window.confirm(reapply
      ? "Re-apply to this placement drive using your current profile details?"
      : "Withdraw this application? You may re-apply while the drive deadline remains open."
    );
    if (!confirmed) return;

    pending.current = true;
    setError("");
    setSuccessMessage("");
    const setBusy = reapply ? setReapplyingApplicationId : setWithdrawingApplicationId;
    setBusy(application.id);
    try {
      const updated = await (reapply
        ? reapplyStudentApplication(application.id)
        : withdrawStudentApplication(application.id));
      if (activeUser.current !== userId) return;
      setApplications((current) => current.map((record) =>
        record.id === updated.id ? { ...record, status: updated.status } : record
      ));
      setSuccessMessage(reapply
        ? "Application submitted again successfully."
        : "Application withdrawn successfully.");
    } catch (requestError) {
      if (activeUser.current === userId) {
        setError(getApplicationErrorMessage(requestError, reapply
          ? "Unable to re-apply to this placement drive."
          : "Unable to withdraw application."));
      }
    } finally {
      pending.current = false;
      if (activeUser.current === userId) setBusy(null);
    }
  }

  return {
    applications, isLoading, withdrawingApplicationId, reapplyingApplicationId,
    error, successMessage,
    handleWithdrawal: (application) => runTransition(application, false),
    handleReapply: (application) => runTransition(application, true),
  };
}
