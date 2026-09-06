import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { APPLICATION_STATUS } from "../constants/applicationStatuses";
import { fetchStudentForProfile } from "../services/studentsService";
import { fetchStudentDrives } from "../services/drivesService";
import { fetchStudentApplications, findStudentApplication, createStudentApplication } from "../services/applicationsService";
import { getApplicationErrorMessage, isDuplicateApplicationError } from "../utils/applicationErrors";
import { getDeadlineClosedMessage, isDeadlineOpen } from "../utils/dates";
import { getDriveActionState, getExistingApplicationMessage, getStatusesByDrive } from "../utils/studentApplications";

export function useStudentDrives() {
  const { user } = useAuth();
  const userId = user?.id;
  const [student, setStudent] = useState(null);
  const [drives, setDrives] = useState([]);
  const [applicationStatusByDriveId, setApplicationStatusByDriveId] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [applyingDriveId, setApplyingDriveId] = useState(null);
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
        const currentStudent = await fetchStudentForProfile(userId);
        const [records, applications] = await Promise.all([
          fetchStudentDrives(),
          fetchStudentApplications(currentStudent.id),
        ]);
        if (!active) return;
        setStudent(currentStudent);
        setDrives(records);
        setApplicationStatusByDriveId(getStatusesByDrive(applications));
      } catch (requestError) {
        if (active) setError(getApplicationErrorMessage(requestError, "Unable to load placement drives."));
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => { active = false; activeUser.current = null; };
  }, [userId]);

  async function handleApply(drive) {
    if (pending.current) return;
    if (!student) {
      setError("Please complete your student profile before applying.");
      return;
    }
    if (!isDeadlineOpen(drive.deadline)) {
      setError(getDeadlineClosedMessage(drive.deadline));
      return;
    }
    pending.current = true;
    setError("");
    setSuccessMessage("");
    setApplyingDriveId(drive.id);
    const isCurrent = () => activeUser.current === userId;
    function showExisting(status) {
      if (!isCurrent()) return;
      setApplicationStatusByDriveId((current) => ({ ...current, [drive.id]: status }));
      setSuccessMessage(getExistingApplicationMessage(status));
    }
    try {
      const existing = await findStudentApplication(student.id, drive.id);
      if (existing) {
        showExisting(existing.status);
        return;
      }
      await createStudentApplication(student.id, drive.id);
      if (!isCurrent()) return;
      setApplicationStatusByDriveId((current) => ({
        ...current, [drive.id]: APPLICATION_STATUS.APPLIED,
      }));
      setSuccessMessage("Application submitted successfully.");
    } catch (requestError) {
      if (isDuplicateApplicationError(requestError)) {
        // The unique constraint also handles concurrent requests after the UX check.
        let existing;
        try { existing = await findStudentApplication(student.id, drive.id); }
        catch { /* Keep the duplicate feedback even if the refresh is unavailable. */ }
        showExisting(existing?.status || APPLICATION_STATUS.APPLIED);
      } else if (isCurrent()) {
        setError(getApplicationErrorMessage(requestError, "Unable to submit application."));
      }
    } finally {
      pending.current = false;
      if (isCurrent()) setApplyingDriveId(null);
    }
  }

  return {
    driveItems: drives.map((drive) => ({
      drive,
      state: getDriveActionState(student, drive, applicationStatusByDriveId[drive.id] || null),
    })),
    student, drives, applicationStatusByDriveId, isLoading, applyingDriveId,
    error, successMessage, handleApply,
  };
}
