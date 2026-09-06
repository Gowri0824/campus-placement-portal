import { useEffect, useMemo, useState } from "react";
import { useStudentResumeAccess } from "./useStudentResumeAccess";
import { fetchStudentDirectory } from "../services/studentsService";
import {
  filterStudents,
  getBranchOptions,
  getGraduationYearOptions,
  getStudentProfileIssueCounts,
  parseMinimumCgpaFilter,
} from "../utils/studentDirectory";

function getErrorMessage(error, fallbackMessage) {
  return error?.message || fallbackMessage;
}

export function useStudentDirectory() {
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [graduationYearFilter, setGraduationYearFilter] = useState("");
  const [minimumCgpaFilter, setMinimumCgpaFilter] = useState("");
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { resumeAccessUrls, openingResumeStudentId, openStudentResume } =
    useStudentResumeAccess(setError);

  useEffect(() => {
    let active = true;

    fetchStudentDirectory()
      .then((records) => {
        if (active) {
          setStudents(records);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            getErrorMessage(requestError, "Unable to load student records."),
          );
          setStudents([]);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const branches = useMemo(() => getBranchOptions(students), [students]);
  const graduationYears = useMemo(
    () => getGraduationYearOptions(students),
    [students],
  );
  const minimumCgpa = useMemo(
    () => parseMinimumCgpaFilter(minimumCgpaFilter),
    [minimumCgpaFilter],
  );
  const filteredStudents = useMemo(
    () =>
      filterStudents(students, {
        searchTerm,
        branchFilter,
        graduationYearFilter,
        minimumCgpa: minimumCgpa.value,
      }),
    [
      branchFilter,
      graduationYearFilter,
      minimumCgpa.value,
      searchTerm,
      students,
    ],
  );
  const { missingProfileCount, profileRoleMismatchCount } = useMemo(
    () => getStudentProfileIssueCounts(students),
    [students],
  );

  function resetFilters() {
    setSearchTerm("");
    setBranchFilter("");
    setGraduationYearFilter("");
    setMinimumCgpaFilter("");
    setExpandedStudentId(null);
  }

  function toggleStudentDetails(studentId) {
    setExpandedStudentId((currentStudentId) =>
      currentStudentId === studentId ? null : studentId,
    );
  }

  return {
    students,
    filteredStudents,
    branches,
    graduationYears,
    searchTerm,
    branchFilter,
    graduationYearFilter,
    minimumCgpaFilter,
    minimumCgpaError: minimumCgpa.error,
    expandedStudentId,
    resumeAccessUrls,
    openingResumeStudentId,
    missingProfileCount,
    profileRoleMismatchCount,
    isLoading,
    error,
    setSearchTerm,
    setBranchFilter,
    setGraduationYearFilter,
    setMinimumCgpaFilter,
    resetFilters,
    toggleStudentDetails,
    openStudentResume,
  };
}
