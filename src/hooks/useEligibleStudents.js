import { useEffect, useMemo, useState } from "react";
import { fetchDriveManagementData } from "../services/drivesService";
import { fetchStudentDirectory } from "../services/studentsService";
import { getEligibleStudents } from "../utils/eligibility";
import { useStudentResumeAccess } from "./useStudentResumeAccess";

export function useEligibleStudents() {
  const [drives, setDrives] = useState([]);
  const [students, setStudents] = useState(null);
  const [selectedDriveId, setSelectedDriveId] = useState("");
  const [isLoadingDrives, setIsLoadingDrives] = useState(true);
  const [error, setError] = useState("");
  const [studentError, setStudentError] = useState("");
  const resume = useStudentResumeAccess(setError);

  useEffect(() => {
    let active = true;
    fetchDriveManagementData()
      .then(({ drives: records }) => { if (active) setDrives(records); })
      .catch((requestError) => {
        if (active) setError(requestError?.message || "Unable to load eligibility data.");
      })
      .finally(() => { if (active) setIsLoadingDrives(false); });
    return () => { active = false; };
  }, []);

  const selectedDrive = drives.find((drive) => drive.id === selectedDriveId) || null;
  const shouldLoadStudents = Boolean(selectedDrive) && students === null;

  useEffect(() => {
    if (!shouldLoadStudents) return;
    let active = true;
    fetchStudentDirectory()
      .then((records) => { if (active) setStudents(records); })
      .catch((requestError) => {
        if (active) setStudentError(requestError?.message || "Unable to load eligibility data.");
      });
    return () => { active = false; };
  }, [shouldLoadStudents, selectedDriveId]);

  const eligibility = useMemo(
    () => selectedDrive && students
      ? getEligibleStudents(students, selectedDrive)
      : { students: [], warnings: [] },
    [students, selectedDrive],
  );

  function selectDrive(id) {
    setSelectedDriveId(id);
    setStudentError("");
  }

  return {
    drives, selectedDriveId, selectedDrive, eligibility, selectDrive,
    isLoadingDrives,
    isLoading: isLoadingDrives || (shouldLoadStudents && !studentError),
    error: error || studentError,
    studentError,
    ...resume,
  };
}
