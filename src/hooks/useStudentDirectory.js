import { useEffect, useMemo, useRef, useState } from "react";
import {
  createStudentResumeAccessUrl,
  fetchStudentDirectory,
} from "../services/studentsService";
import {
  filterStudents,
  getBranchOptions,
  getGraduationYearOptions,
  getSafeHttpUrl,
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
  const [resumeAccessUrls, setResumeAccessUrls] = useState({});
  const [openingResumeStudentId, setOpeningResumeStudentId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    fetchStudentDirectory()
      .then((records) => {
        if (isMounted.current) {
          setStudents(records);
        }
      })
      .catch((requestError) => {
        if (isMounted.current) {
          setError(
            getErrorMessage(requestError, "Unable to load student records."),
          );
          setStudents([]);
        }
      })
      .finally(() => {
        if (isMounted.current) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted.current = false;
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

  async function openStudentResume(student) {
    setError("");
    setOpeningResumeStudentId(student.id);

    const resumeWindow = window.open("about:blank", "_blank");

    if (resumeWindow) {
      resumeWindow.opener = null;
    }

    try {
      const signedUrl = await createStudentResumeAccessUrl(student.resume_path);
      const safeSignedUrl = getSafeHttpUrl(signedUrl);

      if (!safeSignedUrl) {
        throw new Error("The secure resume link is invalid.");
      }

      if (!isMounted.current) {
        resumeWindow?.close();
        return;
      }

      setResumeAccessUrls((currentUrls) => ({
        ...currentUrls,
        [student.id]: safeSignedUrl,
      }));

      if (resumeWindow) {
        resumeWindow.location.replace(safeSignedUrl);
      } else {
        setError(
          "The secure resume link is ready. Select View Resume again to open it.",
        );
      }
    } catch (resumeError) {
      resumeWindow?.close();

      if (isMounted.current) {
        setError(
          getErrorMessage(resumeError, "Unable to open the student resume."),
        );
      }
    } finally {
      if (isMounted.current) {
        setOpeningResumeStudentId(null);
      }
    }
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
