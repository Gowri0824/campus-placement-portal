import { useEffect, useRef, useState } from "react";
import { RESUME_SIGNED_URL_LIFETIME_SECONDS } from "../constants/storage";
import { createStudentResumeAccessUrl } from "../services/studentsService";
import { getSafeHttpUrl } from "../utils/studentDirectory";

export function useStudentResumeAccess(setError) {
  const [resumeAccessUrls, setResumeAccessUrls] = useState({});
  const [openingResumeStudentId, setOpeningResumeStudentId] = useState(null);
  const isMounted = useRef(false);
  const resumeRequestInFlight = useRef(false);
  const resumeCache = useRef({});

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function openStudentResume(student, event) {
    const cached = resumeCache.current[student.id];
    if (
      cached?.path === student.resume_path &&
      cached.expiresAt > Date.now()
    ) {
      return;
    }

    event?.preventDefault();
    if (resumeRequestInFlight.current) {
      return;
    }
    resumeRequestInFlight.current = true;
    setError("");
    setOpeningResumeStudentId(student.id);

    const resumeWindow = window.open("about:blank", "_blank");

    if (resumeWindow) {
      resumeWindow.opener = null;
    }

    try {
      const requestedAt = Date.now();
      const signedUrl = await createStudentResumeAccessUrl(student.resume_path);
      const safeSignedUrl = getSafeHttpUrl(signedUrl);

      if (!safeSignedUrl) {
        throw new Error("The secure resume link is invalid.");
      }

      if (!isMounted.current) {
        resumeWindow?.close();
        return;
      }

      // Renew early so a link cannot expire between clicking and opening it.
      resumeCache.current[student.id] = {
        path: student.resume_path,
        expiresAt: requestedAt + (RESUME_SIGNED_URL_LIFETIME_SECONDS - 60) * 1000,
      };
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
          resumeError?.message || "Unable to open the student resume.",
        );
      }
    } finally {
      resumeRequestInFlight.current = false;
      if (isMounted.current) {
        setOpeningResumeStudentId(null);
      }
    }
  }
  return { resumeAccessUrls, openingResumeStudentId, openStudentResume };
}
